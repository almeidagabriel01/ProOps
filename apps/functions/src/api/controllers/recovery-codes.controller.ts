import { Request, Response } from "express";
import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { auth, db } from "../../init";
import { logger } from "../../lib/logger";
import { writeSecurityAuditEvent } from "../../lib/security-observability";
import { clearUserMfaFactors } from "../../lib/mfa-reset";
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
 * POST /v1/auth/mfa-recovery/recover-totp — public.
 *
 * The user is stuck on the native Firebase TOTP screen (password already
 * entered, but NOT signed in). They submit a recovery code to unlock by
 * removing ONLY the native TOTP factor, keeping WhatsApp 2FA intact.
 *
 * Anti-enumeration: any failure to locate the account / validate the code
 * returns a generic 400 so existence is never leaked. A correct password (for
 * password accounts) is required; Google-only accounts unlock with the code
 * alone. On success the recovery code is consumed atomically.
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

    // Remove only the native TOTP factor; keep WhatsApp MFA enabled.
    await clearUserMfaFactors(uid, { includeWhatsapp: false });

    // Consume the recovery code atomically (same pattern as /verify).
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

    let tenantId: string | undefined;
    try {
      const userSnap = await db.collection("users").doc(uid).get();
      const userData = userSnap.data() as { tenantId?: string } | undefined;
      tenantId = userData?.tenantId;
    } catch {
      tenantId = undefined;
    }

    void writeSecurityAuditEvent({
      eventType: "mfa_totp_recovery_with_code",
      uid,
      tenantId,
      route: req.path,
      requestId: req.requestId,
      reason: hasPassword ? "password" : "google_code_only",
      source: "recovery_codes",
    });

    logger.info("MFA TOTP recovered with recovery code", {
      uid,
      tenantId,
      method: hasPassword ? "password" : "google_code_only",
    });

    return res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    logger.error("recoverTotpWithCode failed", { message });
    return res.status(400).json({ message: GENERIC_RECOVERY_FAILURE });
  }
};
