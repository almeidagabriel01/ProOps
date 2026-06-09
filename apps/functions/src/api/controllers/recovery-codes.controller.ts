import { Request, Response } from "express";
import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { auth, db } from "../../init";
import { logger } from "../../lib/logger";
import { writeSecurityAuditEvent } from "../../lib/security-observability";
import { sendEmail } from "../../services/email/send-email";
import { renderRecoveryCodeUsedEmail } from "../../services/email/templates/mfa-recovery-code-used";
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  verifyRecoveryCode,
  type HashedRecoveryCode,
} from "../../lib/mfa-recovery-codes";

const RECOVERY_CODES_COLLECTION = "mfaRecoveryCodes";
const RECOVERY_CODE_COUNT = 10;

const GENERIC_RECOVERY_FAILURE =
  "Não foi possível concluir a recuperação. Verifique os dados informados.";

const verifySchema = z.object({
  code: z.string().min(1),
});

const recoverTotpSchema = z.object({
  email: z.string().email().max(200).toLowerCase().trim(),
  code: z.string().min(1),
  password: z.string().min(1).max(1024).optional(),
});

interface StoredRecoveryCode {
  hash: string;
  usedAt: Timestamp | null;
}

interface RecoveryCodesDoc {
  uid: string;
  codes: StoredRecoveryCode[];
  generatedAt: Timestamp;
}

/** Count codes that have not yet been consumed. */
function countRemaining(codes: StoredRecoveryCode[]): number {
  return codes.filter((c) => c.usedAt === null || c.usedAt === undefined).length;
}

/** Number of unused recovery codes currently stored for a uid (0 if none). */
async function readRemaining(uid: string): Promise<number> {
  const snap = await db.collection(RECOVERY_CODES_COLLECTION).doc(uid).get();
  if (!snap.exists) return 0;
  const data = snap.data() as RecoveryCodesDoc;
  return countRemaining(data.codes ?? []);
}

/**
 * Recovery codes are only meaningful while at least one 2FA method is active.
 * A user's 2FA = native TOTP factor (Firebase enrolledFactors) AND/OR the
 * WhatsApp MFA flag on their user doc. When BOTH are gone, the stored recovery
 * codes must be deleted so old codes can never be reused after re-enrolling and
 * the remaining count resets to zero.
 *
 * Idempotent: deleting a non-existent doc is a no-op. Returns whether any factor
 * remains and whether the codes were deleted.
 */
export async function reconcileRecoveryCodes(
  uid: string,
): Promise<{ hasAnyFactor: boolean; deleted: boolean }> {
  const factors = (await auth.getUser(uid)).multiFactor?.enrolledFactors ?? [];
  const hasTotp = factors.some((f) => f.factorId === "totp");

  const userSnap = await db.collection("users").doc(uid).get();
  const hasWhatsapp =
    (userSnap.data() as { whatsappMfaEnabled?: boolean } | undefined)
      ?.whatsappMfaEnabled === true;

  const hasAnyFactor = hasTotp || hasWhatsapp;
  if (hasAnyFactor) {
    return { hasAnyFactor: true, deleted: false };
  }

  await db.collection(RECOVERY_CODES_COLLECTION).doc(uid).delete();
  return { hasAnyFactor: false, deleted: true };
}

/**
 * POST /v1/auth/recovery-codes/reconcile — protected.
 *
 * Called by the client after it disables the native TOTP factor (which Firebase
 * removes client-side). Re-evaluates the user's 2FA state and deletes the stored
 * recovery codes if no method remains. Returns the post-reconcile state.
 */
export const reconcileRecoveryCodesHandler = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const uid = req.user!.uid;
    const { hasAnyFactor, deleted } = await reconcileRecoveryCodes(uid);
    const remaining = deleted ? 0 : await readRemaining(uid);
    return res.json({ hasAnyFactor, remaining });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    logger.error("reconcileRecoveryCodesHandler failed", { message });
    return res
      .status(500)
      .json({ message: "Falha ao reconciliar códigos de recuperação." });
  }
};

export const generateRecoveryCodesHandler = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const uid = req.user!.uid;
    const tenantId = req.user!.tenantId;

    const codes = generateRecoveryCodes(RECOVERY_CODE_COUNT);
    const stored: StoredRecoveryCode[] = codes.map((code) => ({
      hash: hashRecoveryCode(code),
      usedAt: null,
    }));

    await db
      .collection(RECOVERY_CODES_COLLECTION)
      .doc(uid)
      .set({
        uid,
        codes: stored,
        generatedAt: Timestamp.now(),
      } satisfies RecoveryCodesDoc);

    void writeSecurityAuditEvent({
      eventType: "recovery_codes_generated",
      uid,
      tenantId,
      route: req.path,
      source: "mfa_recovery_codes",
    });

    logger.info("MFA recovery codes generated", { uid, tenantId });

    return res.json({ codes });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    logger.error("generateRecoveryCodesHandler failed", { message });
    return res.status(500).json({ message: "Falha ao gerar códigos de recuperação." });
  }
};

export const getRecoveryCodesStatusHandler = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const uid = req.user!.uid;

    const snap = await db.collection(RECOVERY_CODES_COLLECTION).doc(uid).get();
    if (!snap.exists) {
      return res.json({ total: 0, remaining: 0 });
    }

    const data = snap.data() as RecoveryCodesDoc;
    const codes = data.codes ?? [];
    const generatedAt = data.generatedAt?.toDate?.().toISOString();

    return res.json({
      total: codes.length,
      remaining: countRemaining(codes),
      ...(generatedAt ? { generatedAt } : {}),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    logger.error("getRecoveryCodesStatusHandler failed", { message });
    return res.status(500).json({ message: "Falha ao consultar códigos de recuperação." });
  }
};

export const verifyRecoveryCodeHandler = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const uid = req.user!.uid;
    const tenantId = req.user!.tenantId;

    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ verified: false, message: "Código de recuperação inválido." });
    }

    const codeRef = db.collection(RECOVERY_CODES_COLLECTION).doc(uid);

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(codeRef);
      if (!snap.exists) {
        return { verified: false as const, remaining: 0 };
      }

      const data = snap.data() as RecoveryCodesDoc;
      const codes = data.codes ?? [];
      const match = verifyRecoveryCode(
        parsed.data.code,
        codes as HashedRecoveryCode[],
      );
      if (!match) {
        return { verified: false as const, remaining: countRemaining(codes) };
      }

      const updatedCodes = codes.map((c, i) =>
        i === match.index ? { ...c, usedAt: Timestamp.now() } : c,
      );
      tx.update(codeRef, { codes: updatedCodes });

      return { verified: true as const, remaining: countRemaining(updatedCodes) };
    });

    if (!result.verified) {
      return res
        .status(400)
        .json({ verified: false, message: "Código de recuperação inválido." });
    }

    void writeSecurityAuditEvent({
      eventType: "recovery_code_used",
      uid,
      tenantId,
      route: req.path,
      source: "mfa_recovery_codes",
    });

    logger.info("MFA recovery code used", { uid, tenantId });

    return res.json({ verified: true, remaining: result.remaining });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    logger.error("verifyRecoveryCodeHandler failed", { message });
    return res.status(500).json({ message: "Falha ao verificar código de recuperação." });
  }
};

function hasPasswordProvider(
  providerData: Array<{ providerId: string }>,
): boolean {
  return providerData.some((p) => p.providerId === "password");
}

/**
 * Super admins are TOTP-mandatory and must use the assisted reset flow. A custom
 * token minted here would lack `sign_in_second_factor`, so the `hasMfa()` gate in
 * the security rules would block them anyway. Detect via custom claims first
 * (authoritative) and fall back to the user document role.
 */
function isSuperAdminRole(role: unknown): boolean {
  return typeof role === "string" && role.toUpperCase() === "SUPERADMIN";
}

/**
 * Verify a password against the Identity Platform REST endpoint. The Admin SDK
 * cannot verify passwords, and a user who lost their TOTP cannot complete a
 * normal client-side sign-in. A correct password returns HTTP 200 (with an
 * idToken, or with an mfaPendingCredential when MFA is enrolled); a wrong
 * password returns 400. Both 200 shapes prove the password.
 */
async function verifyPasswordViaRest(
  email: string,
  password: string,
): Promise<boolean> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    logger.error("recoverTotpWithCode: NEXT_PUBLIC_FIREBASE_API_KEY not configured");
    return false;
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );

  return response.status === 200;
}

/**
 * Best-effort security notification fired after a recovery code is used to sign
 * in. A Resend hiccup must NEVER fail the login — a missed email is far less
 * harmful than blocking a legitimate recovery. Hence the try/catch + log: this
 * helper never throws. The message differs from `mfa-disabled`: here 2FA stays
 * enabled and the code was a one-time alternative to the authenticator challenge.
 */
async function notifyRecoveryCodeUsed(
  email: string | undefined,
  name?: string,
): Promise<void> {
  if (!email) return;
  try {
    const { subject, html, text } = renderRecoveryCodeUsedEmail({ name });
    await sendEmail({
      to: email,
      subject,
      html,
      text,
      type: "mfa_recovery_code_used",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn("recoverTotpWithCode: notification email failed", { message });
  }
}

/**
 * POST /v1/auth/mfa-recovery/recover-totp — public.
 *
 * The user is stuck on the native Firebase TOTP screen (password already
 * entered, but NOT signed in). They submit a recovery code to sign in WITHOUT
 * removing the TOTP factor (GitHub/Google model: the recovery code is a
 * one-time alternative to the 2FA challenge; 2FA stays enrolled). Because the
 * native TOTP factor blocks the normal client-side sign-in, we mint an Admin
 * SDK custom token, which signs the user in without triggering the native MFA
 * challenge. The user manages/reconfigures the authenticator in settings later.
 *
 * Super admins are rejected (403): they are TOTP-mandatory and a custom token
 * lacks `sign_in_second_factor`, so the `hasMfa()` rule gate would block them —
 * they must use the assisted reset flow instead.
 *
 * Anti-enumeration: any failure to locate the account / validate the code
 * returns a generic 400 so existence is never leaked. A correct password (for
 * password accounts) is required; Google-only accounts unlock with the code
 * alone. On success the recovery code is consumed atomically and a custom token
 * is returned.
 */
export const recoverTotpWithCode = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const parsed = recoverTotpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: GENERIC_RECOVERY_FAILURE });
  }

  const { email, code, password } = parsed.data;

  try {
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
    } catch {
      logger.info("recoverTotpWithCode: account not found for email");
      return res.status(400).json({ message: GENERIC_RECOVERY_FAILURE });
    }

    const uid = userRecord.uid;
    const codeRef = db.collection(RECOVERY_CODES_COLLECTION).doc(uid);

    const codesSnap = await codeRef.get();
    if (!codesSnap.exists) {
      return res.status(400).json({ message: GENERIC_RECOVERY_FAILURE });
    }
    const codesData = codesSnap.data() as RecoveryCodesDoc;
    const storedCodes = codesData.codes ?? [];
    const match = verifyRecoveryCode(code, storedCodes as HashedRecoveryCode[]);
    if (!match) {
      return res.status(400).json({ message: GENERIC_RECOVERY_FAILURE });
    }

    const hasPassword = hasPasswordProvider(userRecord.providerData);
    if (hasPassword) {
      if (!password) {
        return res.status(400).json({ message: "Senha incorreta." });
      }
      if (!userRecord.email) {
        return res.status(400).json({ message: GENERIC_RECOVERY_FAILURE });
      }
      const passwordOk = await verifyPasswordViaRest(userRecord.email, password);
      if (!passwordOk) {
        return res.status(400).json({ message: "Senha incorreta." });
      }
    }

    // Resolve tenant + role from the user doc (also used for super-admin gate).
    let tenantId: string | undefined;
    let docRole: unknown;
    let name: string | undefined;
    try {
      const userSnap = await db.collection("users").doc(uid).get();
      const userData = userSnap.data() as
        | { tenantId?: string; role?: string; name?: string }
        | undefined;
      tenantId = userData?.tenantId;
      docRole = userData?.role;
      name = userData?.name;
    } catch {
      tenantId = undefined;
    }

    // Super admins cannot use this path — they must use the assisted reset.
    const claimsRole = userRecord.customClaims?.role;
    if (isSuperAdminRole(claimsRole) || isSuperAdminRole(docRole)) {
      logger.warn("recoverTotpWithCode: super admin blocked", { uid });
      return res.status(403).json({
        message:
          "Contas de super administrador devem usar o reset assistido para recuperar o 2FA.",
      });
    }

    // Mint the custom token FIRST: it signs the user in without the native MFA
    // challenge. If signing fails (e.g. the runtime service account lacks the
    // "Service Account Token Creator" role), we must abort BEFORE consuming the
    // code — otherwise a single-use recovery code is burned without a login.
    // The `recovery_login` claim tells the session gate this login already
    // cleared 2FA, so it must NOT raise a second WhatsApp challenge.
    const customToken = await auth.createCustomToken(uid, {
      recovery_login: true,
    });

    // Consume the recovery code atomically (same pattern as /verify). The TOTP
    // factor is intentionally NOT removed — 2FA stays enrolled.
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(codeRef);
      if (!snap.exists) return;
      const data = snap.data() as RecoveryCodesDoc;
      const codes = data.codes ?? [];
      const consume = verifyRecoveryCode(code, codes as HashedRecoveryCode[]);
      if (!consume) return;
      const updatedCodes = codes.map((c, i) =>
        i === consume.index ? { ...c, usedAt: Timestamp.now() } : c,
      );
      tx.update(codeRef, { codes: updatedCodes });
    });

    void writeSecurityAuditEvent({
      eventType: "mfa_recovery_code_signin",
      uid,
      tenantId,
      route: req.path,
      requestId: req.requestId,
      reason: hasPassword ? "password" : "google_code_only",
      source: "recovery_codes",
    });

    logger.info("MFA recovery code used to sign in", {
      uid,
      tenantId,
      method: hasPassword ? "password" : "google_code_only",
    });

    // Best-effort security email — must not block the login on failure.
    await notifyRecoveryCodeUsed(userRecord.email ?? undefined, name);

    return res.json({ success: true, customToken });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    logger.error("recoverTotpWithCode failed", { message });
    return res.status(400).json({ message: GENERIC_RECOVERY_FAILURE });
  }
};
