import { Request, Response } from "express";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { auth, db } from "../../init";
import { logger } from "../../lib/logger";
import { writeSecurityAuditEvent } from "../../lib/security-observability";
import {
  canSendOtp,
  generateOtpCode,
  getOtpResendCooldownSeconds,
  hashOtp,
  verifyOtp,
} from "../../lib/mfa-otp";
import {
  hasPasswordProvider,
  isSuperAdminRole,
  verifyPasswordViaRest,
} from "./recovery-codes.controller";
import {
  CHALLENGES_COLLECTION,
  deliverOtp,
  hashPhone,
  maskPhone,
  toOtpRecord,
  writeChallenge,
  type ChallengeDoc,
} from "./whatsapp-mfa.controller";

/**
 * Public (pre-auth) WhatsApp fallback for the native TOTP login challenge.
 *
 * When an account has BOTH the native TOTP factor AND WhatsApp MFA enabled, the
 * Firebase sign-in is blocked by the native TOTP challenge and the WhatsApp gate
 * never fires (the session gate skips it when a native second factor exists). A
 * user who can't reach their authenticator app (lost phone, reinstalled) is then
 * stuck. These endpoints let them receive the code via WhatsApp instead and sign
 * in WITHOUT removing the TOTP factor — the same custom-token bypass the recovery
 * code flow (`recover-totp`) uses, since the native challenge blocks a normal
 * client-side sign-in.
 *
 * Anti-enumeration mirrors `recover-totp`: password accounts must pass a correct
 * password (validated via Identity Toolkit) before availability is revealed or an
 * OTP is sent; Google-only accounts (no password provider) unlock with the
 * WhatsApp OTP alone (the code is delivered only to the enrolled phone). Super
 * admins are rejected — they are TOTP-only and never have WhatsApp MFA.
 */

const emailSchema = z.string().email().max(200).toLowerCase().trim();
const passwordSchema = z.string().min(1).max(1024).optional();

const checkSchema = z.object({ email: emailSchema, password: passwordSchema });
const sendSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  resend: z.boolean().optional(),
});
const verifySchema = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/),
});

const GENERIC_FAILURE =
  "Não foi possível concluir a verificação. Verifique os dados informados.";

interface GatedIdentity {
  uid: string;
  tenantId?: string;
  whatsappEnabled: boolean;
  /** Plaintext normalized phone from users/{uid}.whatsappMfaPhone (only set when enabled). */
  normalizedPhone?: string;
}

/**
 * Resolve and authorize the account for the check/send steps. Returns `null`
 * (generic) on any failure so account existence / state is never leaked:
 * unknown email, super admin, or — for password accounts — a missing/incorrect
 * password. Google-only accounts skip the password gate (the OTP is the proof).
 */
async function resolveGatedIdentity(
  email: string,
  password: string | undefined,
): Promise<GatedIdentity | null> {
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
  } catch {
    return null;
  }

  const uid = userRecord.uid;
  const userSnap = await db.collection("users").doc(uid).get();
  const userData = userSnap.data() as
    | {
        tenantId?: string;
        role?: string;
        whatsappMfaEnabled?: boolean;
        whatsappMfaPhone?: string;
      }
    | undefined;

  // Super admins are TOTP-only and must use the assisted reset — never this path.
  const claimsRole = userRecord.customClaims?.role;
  if (isSuperAdminRole(claimsRole) || isSuperAdminRole(userData?.role)) {
    logger.warn("whatsappLoginFallback: super admin blocked", { uid });
    return null;
  }

  // Password accounts must reauthenticate; Google-only accounts unlock via OTP.
  if (hasPasswordProvider(userRecord.providerData)) {
    if (!password) return null;
    const ok = await verifyPasswordViaRest(email, password);
    if (!ok) return null;
  }

  const whatsappEnabled = Boolean(
    userData?.whatsappMfaEnabled && userData?.whatsappMfaPhone,
  );
  return {
    uid,
    tenantId: userData?.tenantId,
    whatsappEnabled,
    normalizedPhone: userData?.whatsappMfaPhone,
  };
}

/**
 * POST /v1/auth/mfa-recovery/whatsapp/availability — public.
 * Reports whether the account can receive its 2FA code via WhatsApp, WITHOUT
 * sending anything. Drives the visibility of the WhatsApp option on the native
 * TOTP screen.
 */
export const checkWhatsappLoginFallback = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const parsed = checkSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.json({ available: false });
  }

  try {
    const identity = await resolveGatedIdentity(
      parsed.data.email,
      parsed.data.password,
    );
    if (!identity || !identity.whatsappEnabled || !identity.normalizedPhone) {
      return res.json({ available: false });
    }
    return res.json({
      available: true,
      maskedPhone: maskPhone(identity.normalizedPhone),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    logger.error("checkWhatsappLoginFallback failed", { message });
    return res.json({ available: false });
  }
};

/**
 * POST /v1/auth/mfa-recovery/whatsapp/send — public.
 * Sends (or, on a still-valid code, reuses) the WhatsApp login OTP. Reuses the
 * shared `mfaOtpChallenges/{uid}` document and the same cooldown/cap logic as the
 * post-auth WhatsApp gate, so the per-user rate limit is shared. Never returns
 * 429 — surfaces `retryAfterSeconds` instead so the UI can show the cooldown.
 */
export const sendWhatsappLoginFallback = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.json({ available: false });
  }

  try {
    const identity = await resolveGatedIdentity(
      parsed.data.email,
      parsed.data.password,
    );
    if (!identity || !identity.whatsappEnabled || !identity.normalizedPhone) {
      return res.json({ available: false });
    }

    const { uid, tenantId, normalizedPhone } = identity;
    const resend = parsed.data.resend === true;

    const challengeRef = db.collection(CHALLENGES_COLLECTION).doc(uid);
    const existingSnap = await challengeRef.get();
    const existing = existingSnap.exists
      ? (existingSnap.data() as ChallengeDoc)
      : null;

    const nowMs = Date.now();
    const sendDecision = canSendOtp(
      existing ? toOtpRecord(existing) : null,
      nowMs,
    );

    const existingExpiresMs =
      typeof existing?.expiresAt === "number"
        ? existing.expiresAt
        : (existing?.expiresAt?.toMillis?.() ?? null);
    const hasValidLoginCode =
      existing !== null &&
      existing.purpose === "login" &&
      existingExpiresMs !== null &&
      existingExpiresMs > nowMs;

    const sendNewCode = async (): Promise<void> => {
      const code = generateOtpCode();
      await writeChallenge({
        uid,
        tenantId: tenantId ?? "",
        purpose: "login",
        phoneHash: hashPhone(normalizedPhone),
        codeHash: hashOtp(code),
        nowMs,
        existing,
      });
      await deliverOtp(normalizedPhone, code);
      logger.info("WhatsApp login fallback OTP sent", { uid, tenantId, resend });
    };

    let otpSent = false;
    let retryAfterSeconds: number;

    if (resend) {
      if (sendDecision.ok) {
        await sendNewCode();
        otpSent = true;
        retryAfterSeconds = getOtpResendCooldownSeconds();
      } else {
        retryAfterSeconds =
          sendDecision.retryAfterSeconds ?? getOtpResendCooldownSeconds();
      }
    } else if (hasValidLoginCode) {
      retryAfterSeconds = sendDecision.ok
        ? 0
        : (sendDecision.retryAfterSeconds ?? 0);
    } else {
      if (sendDecision.ok) {
        await sendNewCode();
        otpSent = true;
        retryAfterSeconds = getOtpResendCooldownSeconds();
      } else {
        retryAfterSeconds = sendDecision.retryAfterSeconds ?? 0;
      }
    }

    return res.json({
      available: true,
      maskedPhone: maskPhone(normalizedPhone),
      otpSent,
      retryAfterSeconds: Math.round(retryAfterSeconds),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    logger.error("sendWhatsappLoginFallback failed", { message });
    return res.status(500).json({ message: "Falha ao enviar o código." });
  }
};

/**
 * POST /v1/auth/mfa-recovery/whatsapp/verify — public.
 * Verifies the WhatsApp login OTP and, on success, mints a Firebase custom token
 * carrying `whatsapp_login: true`. That claim tells the session gate the WhatsApp
 * factor was already satisfied so it must NOT raise a second challenge. The token
 * is minted BEFORE consuming the challenge so a delivery/permission failure can't
 * burn the OTP without producing a login. The TOTP factor stays enrolled.
 */
export const verifyWhatsappLoginFallback = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Código inválido." });
  }

  const { email, code } = parsed.data;

  try {
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
    } catch {
      return res.status(400).json({ message: GENERIC_FAILURE });
    }

    const uid = userRecord.uid;
    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.data() as
      | { tenantId?: string; role?: string }
      | undefined;

    const claimsRole = userRecord.customClaims?.role;
    if (isSuperAdminRole(claimsRole) || isSuperAdminRole(userData?.role)) {
      logger.warn("verifyWhatsappLoginFallback: super admin blocked", { uid });
      return res.status(400).json({ message: GENERIC_FAILURE });
    }

    const challengeRef = db.collection(CHALLENGES_COLLECTION).doc(uid);
    const snap = await challengeRef.get();
    if (!snap.exists) {
      return res.status(400).json({ message: "Código incorreto ou expirado." });
    }
    const record = snap.data() as ChallengeDoc;

    const result = verifyOtp(code, toOtpRecord(record), "login", Date.now());
    if (!result.ok) {
      if (result.reason === "mismatch") {
        await challengeRef.update({ attempts: FieldValue.increment(1) });
      }
      return res.status(400).json({
        message: "Código incorreto ou expirado.",
        code: result.reason,
        attemptsLeft:
          result.reason === "mismatch" ? result.attemptsLeft : undefined,
      });
    }

    // Mint FIRST (see doc comment), then consume the challenge.
    const customToken = await auth.createCustomToken(uid, {
      whatsapp_login: true,
    });
    await challengeRef.delete();

    void writeSecurityAuditEvent({
      eventType: "whatsapp_mfa_login_verified",
      uid,
      tenantId: userData?.tenantId,
      route: req.path,
      requestId: req.requestId,
      source: "whatsapp_login_fallback",
    });

    logger.info("WhatsApp login fallback used to sign in", {
      uid,
      tenantId: userData?.tenantId,
    });

    return res.json({ success: true, customToken });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    logger.error("verifyWhatsappLoginFallback failed", { message });
    return res.status(400).json({ message: GENERIC_FAILURE });
  }
};
