import { Request, Response } from "express";
import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { auth, db } from "../../init";
import { logger } from "../../lib/logger";
import { resolveTrustedRequestOrigin } from "../../lib/request-origin";
import { sendEmail } from "../../services/email/send-email";
import { renderMfaRecoveryEmail } from "../../services/email/templates/mfa-recovery";
import {
  generateRecoveryToken,
  parseRecoveryToken,
} from "../../lib/mfa-recovery-token";
import { evaluateRecoveryEligibility } from "../../lib/mfa-recovery-authz";
import { clearUserMfaFactors } from "../../lib/mfa-reset";
import { writeSecurityAuditEvent } from "../../lib/security-observability";

const RECOVERY_TOKENS_COLLECTION = "mfaRecoveryTokens";

const RequestRecoverySchema = z.object({
  email: z.string().email().max(200).toLowerCase().trim(),
});

const InspectTokenSchema = z.object({
  token: z.string().min(1).max(4096),
});

const ConfirmRecoverySchema = z.object({
  token: z.string().min(1).max(4096),
  password: z.string().min(1).max(1024).optional(),
});

const GENERIC_OK_RESPONSE = { success: true } as const;

interface RecoveryTokenDoc {
  uid: string;
  hasPasswordProvider: boolean;
  expiresAt: Timestamp | number;
  used: boolean;
  createdAt: Timestamp | number;
}

function isTokenExpired(expiresAt: Timestamp | number): boolean {
  const expiresMs =
    typeof expiresAt === "number" ? expiresAt : expiresAt.toMillis();
  return Date.now() > expiresMs;
}

function hasPasswordProvider(
  providerData: Array<{ providerId: string }>,
): boolean {
  return providerData.some((p) => p.providerId === "password");
}

/**
 * POST /v1/auth/forgot-mfa — public.
 * Always responds `{ success: true }` (anti-enumeration). Sends a recovery link
 * only when the account exists and its email is verified.
 */
export async function requestMfaRecovery(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = RequestRecoverySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(200).json(GENERIC_OK_RESPONSE);
    return;
  }

  const { email } = parsed.data;
  const origin = resolveTrustedRequestOrigin(req);

  try {
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: string }).code)
          : "";
      if (
        code === "auth/user-not-found" ||
        code === "auth/email-not-found"
      ) {
        logger.info("[mfa-recovery] recovery requested for unknown email");
        res.status(200).json(GENERIC_OK_RESPONSE);
        return;
      }
      throw err;
    }

    const eligibility = evaluateRecoveryEligibility({
      userExists: true,
      emailVerified: Boolean(userRecord.emailVerified),
    });

    if (!eligibility.send) {
      logger.info("[mfa-recovery] recovery not eligible (unverified email)");
      res.status(200).json(GENERIC_OK_RESPONSE);
      return;
    }

    const hasPassword = hasPasswordProvider(userRecord.providerData);
    const token = generateRecoveryToken(userRecord.uid);
    const parsedToken = parseRecoveryToken(token);
    if (!parsedToken) {
      logger.error("[mfa-recovery] generated token failed to parse");
      res.status(200).json(GENERIC_OK_RESPONSE);
      return;
    }

    const ttlSeconds = Number(process.env.MFA_RECOVERY_TTL_SECONDS) || 1800;
    const expiresAt = Timestamp.fromMillis(Date.now() + ttlSeconds * 1000);

    await db
      .collection(RECOVERY_TOKENS_COLLECTION)
      .doc(parsedToken.tokenId)
      .set({
        uid: userRecord.uid,
        hasPasswordProvider: hasPassword,
        expiresAt,
        used: false,
        createdAt: Timestamp.now(),
      });

    const recoverUrl = `${origin}/recover-mfa?token=${encodeURIComponent(token)}`;
    const { subject, html, text } = renderMfaRecoveryEmail({ recoverUrl });

    const result = await sendEmail({
      to: email,
      subject,
      html,
      text,
      type: "mfa_recovery",
    });

    if (!result.ok) {
      logger.error("[mfa-recovery] recovery email send failed", {
        error: result.error,
      });
    } else {
      logger.info("[mfa-recovery] recovery email sent", {
        messageId: result.messageId,
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[mfa-recovery] requestMfaRecovery failed", {
      error: message,
    });
  }

  res.status(200).json(GENERIC_OK_RESPONSE);
}

/**
 * POST /v1/auth/mfa-recovery/inspect — public.
 * Given a valid, unused, unexpired token, returns `{ valid, hasPassword }` so
 * the recovery page can decide whether to ask for a password. Never leaks
 * anything without a valid token.
 */
export async function inspectMfaRecoveryToken(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = InspectTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(200).json({ valid: false });
    return;
  }

  try {
    const tokenInfo = parseRecoveryToken(parsed.data.token);
    if (!tokenInfo) {
      res.status(200).json({ valid: false });
      return;
    }

    const docSnap = await db
      .collection(RECOVERY_TOKENS_COLLECTION)
      .doc(tokenInfo.tokenId)
      .get();
    const doc = docSnap.data() as RecoveryTokenDoc | undefined;

    if (
      !docSnap.exists ||
      !doc ||
      doc.used ||
      doc.uid !== tokenInfo.uid ||
      isTokenExpired(doc.expiresAt)
    ) {
      res.status(200).json({ valid: false });
      return;
    }

    res.status(200).json({ valid: true, hasPassword: doc.hasPasswordProvider });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[mfa-recovery] inspectMfaRecoveryToken failed", {
      error: message,
    });
    res.status(200).json({ valid: false });
  }
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
    logger.error("[mfa-recovery] NEXT_PUBLIC_FIREBASE_API_KEY not configured");
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
 * POST /v1/auth/mfa-recovery/confirm — public.
 * Validates the single-use token, re-authenticates by password (password
 * accounts) or accepts the link alone (Google-only accounts), then removes the
 * MFA factors and marks the token used.
 */
export async function confirmMfaRecovery(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = ConfirmRecoverySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Token inválido ou expirado." });
    return;
  }

  const { token, password } = parsed.data;

  try {
    const tokenInfo = parseRecoveryToken(token);
    if (!tokenInfo) {
      res.status(400).json({ message: "Token inválido ou expirado." });
      return;
    }

    const tokenRef = db
      .collection(RECOVERY_TOKENS_COLLECTION)
      .doc(tokenInfo.tokenId);
    const docSnap = await tokenRef.get();
    const doc = docSnap.data() as RecoveryTokenDoc | undefined;

    if (
      !docSnap.exists ||
      !doc ||
      doc.used ||
      doc.uid !== tokenInfo.uid ||
      isTokenExpired(doc.expiresAt)
    ) {
      res.status(400).json({ message: "Token inválido ou expirado." });
      return;
    }

    const uid = tokenInfo.uid;
    const userRecord = await auth.getUser(uid);
    const hasPassword = hasPasswordProvider(userRecord.providerData);

    if (hasPassword) {
      if (!password) {
        res.status(400).json({ message: "Senha incorreta." });
        return;
      }
      const email = userRecord.email;
      if (!email) {
        res.status(400).json({ message: "Token inválido ou expirado." });
        return;
      }
      const passwordOk = await verifyPasswordViaRest(email, password);
      if (!passwordOk) {
        res.status(400).json({ message: "Senha incorreta." });
        return;
      }
    }

    await clearUserMfaFactors(uid);
    await tokenRef.update({ used: true });

    void writeSecurityAuditEvent({
      eventType: "mfa_self_recovery",
      uid,
      tenantId: undefined,
      eventId: tokenInfo.tokenId,
      route: req.path,
      requestId: req.requestId,
      reason: hasPassword ? "password" : "google_link_only",
      source: "mfa_recovery_controller",
    });

    logger.info("[mfa-recovery] self-recovery completed", {
      uid,
      method: hasPassword ? "password" : "google_link_only",
    });

    res.status(200).json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[mfa-recovery] confirmMfaRecovery failed", {
      error: message,
    });
    res.status(400).json({ message: "Token inválido ou expirado." });
  }
}
