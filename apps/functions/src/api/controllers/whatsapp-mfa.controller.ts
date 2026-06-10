import { Request, Response } from "express";
import { createHash } from "crypto";
import { z } from "zod";
import { FieldValue, Timestamp, Transaction } from "firebase-admin/firestore";
import { db } from "../../init";
import { logger } from "../../lib/logger";
import { isSuperAdminClaim } from "../../lib/request-auth";
import { reconcileRecoveryCodes } from "./recovery-codes.controller";
import { writeSecurityAuditEvent } from "../../lib/security-observability";
import {
  canSendOtp,
  generateOtpCode,
  getOtpMaxAttempts,
  getOtpResendCooldownSeconds,
  getOtpTtlSeconds,
  hashOtp,
  verifyOtp,
  type OtpPurpose,
  type OtpRecord,
} from "../../lib/mfa-otp";
import { sendWhatsAppTemplate } from "../services/whatsapp/whatsapp.api";
import { normalizePhoneNumber } from "../services/whatsapp/whatsapp.utils";

export const CHALLENGES_COLLECTION = "mfaOtpChallenges";

const enrollStartSchema = z.object({
  phone: z.string().min(1),
});

const codeSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
});

const challengeSchema = z.object({
  resend: z.boolean().optional(),
});

export interface ChallengeDoc {
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
export function hashPhone(normalizedPhone: string): string {
  return createHash("sha256").update(normalizedPhone).digest("hex");
}

/** Mask a normalized phone, revealing only the last 4 digits. */
export function maskPhone(normalizedPhone: string): string {
  const last4 = normalizedPhone.slice(-4);
  return `••••${last4}`;
}

export function toOtpRecord(data: ChallengeDoc): OtpRecord {
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

export async function deliverOtp(
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

export interface WriteChallengeParams {
  uid: string;
  tenantId: string;
  purpose: OtpPurpose;
  phoneHash: string;
  codeHash: string;
  nowMs: number;
  existing: ChallengeDoc | null;
}

/**
 * Build the OTP challenge document for a (re)issued code, advancing the hourly
 * send-window counters. Pure given `nowMs` and `existing` — persistence is done
 * by writeChallenge (standalone) or writeChallengeTx (inside a transaction) so
 * the read → decide → reserve sequence can be made atomic.
 */
export function buildChallengeDoc(params: WriteChallengeParams): ChallengeDoc {
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

  return {
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
  } satisfies ChallengeDoc;
}

/**
 * Persist (create or refresh) the OTP challenge for a uid, advancing the
 * hourly send-window counters. Always called after canSendOtp() approved a send.
 */
export async function writeChallenge(
  params: WriteChallengeParams,
): Promise<void> {
  await db
    .collection(CHALLENGES_COLLECTION)
    .doc(params.uid)
    .set(buildChallengeDoc(params));
}

/**
 * Transactional variant of writeChallenge — reserves the send inside an open
 * transaction so two concurrent challenge requests can't both pass canSendOtp
 * and both deliver a code (duplicate WhatsApp codes).
 */
export function writeChallengeTx(
  tx: Transaction,
  params: WriteChallengeParams,
): void {
  tx.set(
    db.collection(CHALLENGES_COLLECTION).doc(params.uid),
    buildChallengeDoc(params),
  );
}

/**
 * Global "one WhatsApp number = one account" guard for MFA. Returns true when a
 * DIFFERENT user already has this normalized phone as their active
 * whatsappMfaPhone. Reads the live user docs (the source of truth), so disabling
 * MFA frees the number automatically — there is no separate index to keep in sync.
 */
export async function isWhatsappMfaPhoneTaken(
  normalizedPhone: string,
  selfUid: string,
): Promise<boolean> {
  const snap = await db
    .collection("users")
    .where("whatsappMfaPhone", "==", normalizedPhone)
    .limit(2)
    .get();
  return snap.docs.some((doc) => doc.id !== selfUid);
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

    // One WhatsApp number = one account. Reject early (before spending an OTP)
    // if this number is already enrolled as MFA on a different account.
    if (await isWhatsappMfaPhoneTaken(normalizedPhone, uid)) {
      return res.status(409).json({
        message: "Este número de WhatsApp já está vinculado a outra conta.",
        code: "phone_in_use",
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
        retryAfterSeconds:
          sendDecision.retryAfterSeconds ?? getOtpResendCooldownSeconds(),
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

    return res.json({
      success: true,
      maskedPhone: maskPhone(normalizedPhone),
      retryAfterSeconds: getOtpResendCooldownSeconds(),
    });
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

    // Authoritative uniqueness gate (closes the start→verify race): re-check that
    // no OTHER account claimed this number while this OTP was outstanding.
    const pendingSnap = await db.collection("users").doc(uid).get();
    const pendingPhone = pendingSnap.data()?.whatsappMfaPendingPhone as
      | string
      | undefined;
    if (
      pendingPhone &&
      hashPhone(pendingPhone) === record.phoneHash &&
      (await isWhatsappMfaPhoneTaken(pendingPhone, uid))
    ) {
      return res.status(409).json({
        message: "Este número de WhatsApp já está vinculado a outra conta.",
        code: "phone_in_use",
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

    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.data() as
      | { whatsappMfaEnabled?: boolean; whatsappMfaPhone?: string }
      | undefined;

    if (!userData?.whatsappMfaEnabled || !userData.whatsappMfaPhone) {
      return res.json({ mfaRequired: false });
    }

    const resend = challengeSchema.safeParse(req.body).data?.resend === true;

    const normalizedPhone = userData.whatsappMfaPhone;
    const challengeRef = db.collection(CHALLENGES_COLLECTION).doc(uid);

    // The read → canSendOtp → reserve-write MUST be atomic. This endpoint is hit
    // concurrently on every login (foreground session POST + background token
    // listeners, token refresh, Google redirect). Without a transaction two
    // racing requests both read the same (stale) state, both pass canSendOtp,
    // and both deliver a code — the user receives two WhatsApp codes. The
    // transaction serializes the reservation: the loser retries, re-reads the
    // just-written cooldown, and declines to send. deliverOtp (an external
    // WhatsApp call, non-retryable) stays OUTSIDE the transaction.
    //
    // This endpoint is also invoked automatically by the login session flow and
    // must always respond 200 with the gate (never 429) — a 429 would swallow
    // the gate and stall the login. So "can't send" surfaces retryAfterSeconds
    // rather than an error.
    type ChallengeOutcome =
      | { action: "send"; code: string; retryAfterSeconds: number }
      | { action: "reuse" | "none"; retryAfterSeconds: number };

    const outcome = await db.runTransaction<ChallengeOutcome>(async (tx) => {
      const snap = await tx.get(challengeRef);
      const existing = snap.exists ? (snap.data() as ChallengeDoc) : null;

      const nowMs = Date.now();
      const sendDecision = canSendOtp(
        existing ? toOtpRecord(existing) : null,
        nowMs,
      );

      // Is there a still-valid login code we can reuse instead of issuing a new
      // one? Defend against expiresAt being either a number or a Timestamp.
      const existingExpiresMs =
        typeof existing?.expiresAt === "number"
          ? existing.expiresAt
          : (existing?.expiresAt?.toMillis?.() ?? null);
      const hasValidLoginCode =
        existing !== null &&
        existing.purpose === "login" &&
        existingExpiresMs !== null &&
        existingExpiresMs > nowMs;

      // Reserve a fresh code: generateOtpCode() + writeChallengeTx() (advances
      // the cooldown / hourly send-count inside the transaction). The actual
      // WhatsApp delivery happens after the transaction commits.
      const reserveNewCode = (): string => {
        const code = generateOtpCode();
        writeChallengeTx(tx, {
          uid,
          tenantId,
          purpose: "login",
          phoneHash: hashPhone(normalizedPhone),
          codeHash: hashOtp(code),
          nowMs,
          existing,
        });
        return code;
      };

      if (resend) {
        // Explicit "Resend" click: send a fresh code if the cooldown/cap allows;
        // otherwise surface how long until the next send is permitted.
        if (sendDecision.ok) {
          return {
            action: "send",
            code: reserveNewCode(),
            retryAfterSeconds: getOtpResendCooldownSeconds(),
          };
        }
        return {
          action: "none",
          retryAfterSeconds:
            sendDecision.retryAfterSeconds ?? getOtpResendCooldownSeconds(),
        };
      }

      if (hasValidLoginCode) {
        // Auto-challenge with a still-valid pending code: reuse it. Do NOT send
        // and do NOT advance the send counters — keeps login/reload from burning
        // the hourly send cap. retryAfterSeconds is 0 once the cooldown elapsed
        // (resend already unlocked), otherwise the remaining cooldown.
        return {
          action: "reuse",
          retryAfterSeconds: sendDecision.ok
            ? 0
            : (sendDecision.retryAfterSeconds ?? 0),
        };
      }

      // Auto-challenge with no valid code (first access or expired): issue one if
      // allowed. Rare edge: no code AND capped — we simply can't send yet.
      if (sendDecision.ok) {
        return {
          action: "send",
          code: reserveNewCode(),
          retryAfterSeconds: getOtpResendCooldownSeconds(),
        };
      }
      return {
        action: "none",
        retryAfterSeconds: sendDecision.retryAfterSeconds ?? 0,
      };
    });

    let otpSent = false;
    if (outcome.action === "send") {
      await deliverOtp(normalizedPhone, outcome.code);
      logger.info("WhatsApp MFA login OTP sent", { uid, tenantId, resend });
      otpSent = true;
    }

    return res.json({
      mfaRequired: true,
      method: "whatsapp",
      maskedPhone: maskPhone(normalizedPhone),
      otpSent,
      retryAfterSeconds: Math.round(outcome.retryAfterSeconds),
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

    // With WhatsApp now off, drop the recovery codes if no 2FA method remains
    // (i.e. the user also has no native TOTP factor). Idempotent.
    await reconcileRecoveryCodes(uid);

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
