import { Request, Response } from "express";
import { createHash } from "crypto";
import { z } from "zod";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db, auth } from "../../init";
import { logger } from "../../lib/logger";
import { isSuperAdminClaim } from "../../lib/request-auth";
import { writeSecurityAuditEvent } from "../../lib/security-observability";
import {
  canSendOtp,
  generateOtpCode,
  getOtpMaxAttempts,
  getOtpTtlSeconds,
  hashOtp,
  verifyOtp,
  type OtpPurpose,
  type OtpRecord,
} from "../../lib/mfa-otp";
import { sendWhatsAppTemplate } from "../services/whatsapp/whatsapp.api";
import { normalizePhoneNumber } from "../services/whatsapp/whatsapp.utils";

const CHALLENGES_COLLECTION = "mfaOtpChallenges";

const enrollStartSchema = z.object({
  phone: z.string().min(1),
});

const codeSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
});

interface ChallengeDoc {
  uid: string;
  tenantId: string;
  purpose: OtpPurpose;
  phoneHash: string;
  codeHash: string;
  expiresAt: Timestamp;
  attempts: number;
  maxAttempts: number;
  lastSentAt: Timestamp;
  sendCount: number;
  sendWindowStart: Timestamp;
  createdAt: Timestamp;
}

/** SHA-256 hash of a normalized phone number — never store the raw phone here. */
function hashPhone(normalizedPhone: string): string {
  return createHash("sha256").update(normalizedPhone).digest("hex");
}

/** Mask a normalized phone, revealing only the last 4 digits. */
function maskPhone(normalizedPhone: string): string {
  const last4 = normalizedPhone.slice(-4);
  return `••••${last4}`;
}

async function hasTotpFactor(uid: string): Promise<boolean> {
  const userRecord = await auth.getUser(uid);
  const factors = userRecord.multiFactor?.enrolledFactors ?? [];
  return factors.some((factor) => factor.factorId === "totp");
}

function toOtpRecord(data: ChallengeDoc): OtpRecord {
  return {
    codeHash: data.codeHash,
    expiresAt: data.expiresAt,
    attempts: data.attempts,
    maxAttempts: data.maxAttempts,
    purpose: data.purpose,
    lastSentAt: data.lastSentAt,
    sendCount: data.sendCount,
    sendWindowStart: data.sendWindowStart,
  };
}

/**
 * Build the components for a WhatsApp Authentication-category template.
 * The verification code is passed both to the message body and to the
 * one-tap copy-code button (index 0).
 */
function buildOtpTemplateComponents(code: string): unknown[] {
  return [
    {
      type: "body",
      parameters: [{ type: "text", text: code }],
    },
    {
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: code }],
    },
  ];
}

async function deliverOtp(
  normalizedPhone: string,
  code: string,
): Promise<void> {
  const templateName = process.env.WHATSAPP_OTP_TEMPLATE_NAME;
  const lang = process.env.WHATSAPP_OTP_TEMPLATE_LANG || "pt_BR";
  if (!templateName) {
    throw new Error("WHATSAPP_OTP_TEMPLATE_NAME env var not configured");
  }
  await sendWhatsAppTemplate(
    normalizedPhone,
    templateName,
    lang,
    buildOtpTemplateComponents(code),
  );
}

/**
 * Persist (create or refresh) the OTP challenge for a uid, advancing the
 * hourly send-window counters. Always called after canSendOtp() approved a send.
 */
async function writeChallenge(params: {
  uid: string;
  tenantId: string;
  purpose: OtpPurpose;
  phoneHash: string;
  codeHash: string;
  nowMs: number;
  existing: ChallengeDoc | null;
}): Promise<void> {
  const { uid, tenantId, purpose, phoneHash, codeHash, nowMs, existing } =
    params;
  const now = Timestamp.fromMillis(nowMs);
  const expiresAt = Timestamp.fromMillis(nowMs + getOtpTtlSeconds() * 1000);

  const windowMs = 60 * 60 * 1000;
  const prevWindowStartMs = existing?.sendWindowStart?.toMillis() ?? null;
  const windowStillOpen =
    prevWindowStartMs !== null && nowMs - prevWindowStartMs < windowMs;
  const sendWindowStart = windowStillOpen
    ? (existing as ChallengeDoc).sendWindowStart
    : now;
  const sendCount = windowStillOpen ? (existing?.sendCount ?? 0) + 1 : 1;

  await db
    .collection(CHALLENGES_COLLECTION)
    .doc(uid)
    .set({
      uid,
      tenantId,
      purpose,
      phoneHash,
      codeHash,
      expiresAt,
      attempts: 0,
      maxAttempts: getOtpMaxAttempts(),
      lastSentAt: now,
      sendCount,
      sendWindowStart,
      createdAt: existing?.createdAt ?? now,
    } satisfies ChallengeDoc);
}

export const startWhatsappEnroll = async (req: Request, res: Response) => {
  try {
    const uid = req.user!.uid;
    const tenantId = req.user!.tenantId;

    if (isSuperAdminClaim(req)) {
      return res.status(403).json({
        message:
          "Super admins devem usar aplicativo autenticador (TOTP) como 2FA.",
      });
    }

    const parsed = enrollStartSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Telefone inválido." });
    }

    const normalizedPhone = normalizePhoneNumber(parsed.data.phone);
    if (!normalizedPhone || normalizedPhone.length < 12) {
      return res.status(400).json({ message: "Telefone inválido." });
    }

    if (await hasTotpFactor(uid)) {
      return res.status(409).json({
        message:
          "Você já tem um aplicativo autenticador (TOTP) ativo. Desative-o antes de ativar o WhatsApp.",
      });
    }

    const challengeRef = db.collection(CHALLENGES_COLLECTION).doc(uid);
    const existingSnap = await challengeRef.get();
    const existing = existingSnap.exists
      ? (existingSnap.data() as ChallengeDoc)
      : null;

    const nowMs = Date.now();
    const sendDecision = canSendOtp(existing ? toOtpRecord(existing) : null, nowMs);
    if (!sendDecision.ok) {
      if (sendDecision.retryAfterSeconds) {
        res.set("Retry-After", String(sendDecision.retryAfterSeconds));
      }
      return res.status(429).json({
        message:
          sendDecision.reason === "cooldown"
            ? "Aguarde antes de solicitar um novo código."
            : "Limite de envios atingido. Tente novamente mais tarde.",
        code: sendDecision.reason,
      });
    }

    const code = generateOtpCode();
    await writeChallenge({
      uid,
      tenantId,
      purpose: "enroll",
      phoneHash: hashPhone(normalizedPhone),
      codeHash: hashOtp(code),
      nowMs,
      existing,
    });

    // Stash the plaintext normalized phone as pending on the user doc so the
    // verify step can promote it to whatsappMfaPhone. The challenge doc itself
    // only ever stores the phone HASH.
    await db.collection("users").doc(uid).set(
      { whatsappMfaPendingPhone: normalizedPhone },
      { merge: true },
    );

    await deliverOtp(normalizedPhone, code);

    logger.info("WhatsApp MFA enroll OTP sent", { uid, tenantId });

    return res.json({ success: true, maskedPhone: maskPhone(normalizedPhone) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    logger.error("startWhatsappEnroll failed", { message });
    return res.status(500).json({ message: "Falha ao enviar código." });
  }
};

export const verifyWhatsappEnroll = async (req: Request, res: Response) => {
  try {
    const uid = req.user!.uid;
    const tenantId = req.user!.tenantId;

    const parsed = codeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Código inválido." });
    }

    const challengeRef = db.collection(CHALLENGES_COLLECTION).doc(uid);
    const snap = await challengeRef.get();
    if (!snap.exists) {
      return res.status(400).json({ message: "Nenhum código pendente." });
    }
    const record = snap.data() as ChallengeDoc;

    const result = verifyOtp(parsed.data.code, toOtpRecord(record), "enroll", Date.now());
    if (!result.ok) {
      if (result.reason === "mismatch") {
        await challengeRef.update({ attempts: FieldValue.increment(1) });
      }
      return res.status(400).json({
        message: "Código incorreto ou expirado.",
        code: result.reason,
        attemptsLeft: result.reason === "mismatch" ? result.attemptsLeft : undefined,
      });
    }

    // Enable the WhatsApp MFA flag and promote the pending plaintext phone to
    // whatsappMfaPhone — but only if it matches the phoneHash bound to the
    // challenge (defends against the pending field being tampered mid-flow).
    // We deliberately do NOT write phoneNumberIndex, to avoid colliding with
    // the WhatsApp bot's phone→user routing.
    await db.collection("users").doc(uid).set(
      {
        whatsappMfaEnabled: true,
      },
      { merge: true },
    );
    await persistEnrolledPhone(uid, record);

    await challengeRef.delete();

    void writeSecurityAuditEvent({
      eventType: "whatsapp_mfa_enroll",
      uid,
      tenantId,
      route: req.path,
      source: "whatsapp_mfa",
    });

    logger.info("WhatsApp MFA enrolled", { uid, tenantId });

    return res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    logger.error("verifyWhatsappEnroll failed", { message });
    return res.status(500).json({ message: "Falha ao confirmar código." });
  }
};

/**
 * The challenge doc stores only the phone HASH. The start handler stashes the
 * plaintext normalized phone on users/{uid}.whatsappMfaPendingPhone; here we
 * promote it to whatsappMfaPhone iff its hash matches the challenge's
 * phoneHash, then clear the pending field.
 */
async function persistEnrolledPhone(
  uid: string,
  record: ChallengeDoc,
): Promise<void> {
  // The plaintext phone was written to the user doc as pending during start.
  const userSnap = await db.collection("users").doc(uid).get();
  const pending = userSnap.data()?.whatsappMfaPendingPhone as string | undefined;
  if (pending && hashPhone(pending) === record.phoneHash) {
    await db.collection("users").doc(uid).set(
      {
        whatsappMfaPhone: pending,
        whatsappMfaPendingPhone: FieldValue.delete(),
      },
      { merge: true },
    );
  }
}

export const challengeWhatsappLogin = async (req: Request, res: Response) => {
  try {
    const uid = req.user!.uid;
    const tenantId = req.user!.tenantId;

    // Auto-reconciliation: if the user has a native TOTP factor, WhatsApp MFA
    // is redundant/dormant — clear the flag and skip the WhatsApp gate.
    if (await hasTotpFactor(uid)) {
      await db.collection("users").doc(uid).set(
        { whatsappMfaEnabled: false },
        { merge: true },
      );
      return res.json({ mfaRequired: false });
    }

    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.data() as
      | { whatsappMfaEnabled?: boolean; whatsappMfaPhone?: string }
      | undefined;

    if (!userData?.whatsappMfaEnabled || !userData.whatsappMfaPhone) {
      return res.json({ mfaRequired: false });
    }

    const normalizedPhone = userData.whatsappMfaPhone;
    const challengeRef = db.collection(CHALLENGES_COLLECTION).doc(uid);
    const existingSnap = await challengeRef.get();
    const existing = existingSnap.exists
      ? (existingSnap.data() as ChallengeDoc)
      : null;

    const nowMs = Date.now();
    const sendDecision = canSendOtp(existing ? toOtpRecord(existing) : null, nowMs);
    if (!sendDecision.ok) {
      if (sendDecision.retryAfterSeconds) {
        res.set("Retry-After", String(sendDecision.retryAfterSeconds));
      }
      return res.status(429).json({
        message:
          sendDecision.reason === "cooldown"
            ? "Aguarde antes de solicitar um novo código."
            : "Limite de envios atingido. Tente novamente mais tarde.",
        code: sendDecision.reason,
      });
    }

    const code = generateOtpCode();
    await writeChallenge({
      uid,
      tenantId,
      purpose: "login",
      phoneHash: hashPhone(normalizedPhone),
      codeHash: hashOtp(code),
      nowMs,
      existing,
    });

    await deliverOtp(normalizedPhone, code);

    logger.info("WhatsApp MFA login OTP sent", { uid, tenantId });

    return res.json({
      mfaRequired: true,
      method: "whatsapp",
      maskedPhone: maskPhone(normalizedPhone),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    logger.error("challengeWhatsappLogin failed", { message });
    return res.status(500).json({ message: "Falha ao iniciar verificação." });
  }
};

export const verifyWhatsappLogin = async (req: Request, res: Response) => {
  try {
    const uid = req.user!.uid;
    const tenantId = req.user!.tenantId;

    const parsed = codeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Código inválido." });
    }

    const challengeRef = db.collection(CHALLENGES_COLLECTION).doc(uid);
    const snap = await challengeRef.get();
    if (!snap.exists) {
      return res.status(400).json({ message: "Nenhum código pendente." });
    }
    const record = snap.data() as ChallengeDoc;

    const result = verifyOtp(parsed.data.code, toOtpRecord(record), "login", Date.now());
    if (!result.ok) {
      if (result.reason === "mismatch") {
        await challengeRef.update({ attempts: FieldValue.increment(1) });
      }
      return res.status(400).json({
        message: "Código incorreto ou expirado.",
        code: result.reason,
        attemptsLeft: result.reason === "mismatch" ? result.attemptsLeft : undefined,
      });
    }

    await challengeRef.delete();

    void writeSecurityAuditEvent({
      eventType: "whatsapp_mfa_login_verified",
      uid,
      tenantId,
      route: req.path,
      source: "whatsapp_mfa",
    });

    return res.json({ verified: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    logger.error("verifyWhatsappLogin failed", { message });
    return res.status(500).json({ message: "Falha ao verificar código." });
  }
};

export const disableWhatsappMfa = async (req: Request, res: Response) => {
  try {
    const uid = req.user!.uid;
    const tenantId = req.user!.tenantId;

    await db.collection("users").doc(uid).set(
      {
        whatsappMfaEnabled: false,
        whatsappMfaPhone: FieldValue.delete(),
        whatsappMfaPendingPhone: FieldValue.delete(),
      },
      { merge: true },
    );

    await db.collection(CHALLENGES_COLLECTION).doc(uid).delete().catch(() => {});

    void writeSecurityAuditEvent({
      eventType: "whatsapp_mfa_disabled",
      uid,
      tenantId,
      route: req.path,
      source: "whatsapp_mfa",
    });

    logger.info("WhatsApp MFA disabled", { uid, tenantId });

    return res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    logger.error("disableWhatsappMfa failed", { message });
    return res.status(500).json({ message: "Falha ao desativar." });
  }
};
