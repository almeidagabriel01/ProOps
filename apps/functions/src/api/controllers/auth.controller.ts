import { Request, Response } from "express";
import { z } from "zod";
import { auth } from "../../init";
import { logger } from "../../lib/logger";
import { resolveTrustedRequestOrigin } from "../../lib/request-origin";
import { sendEmail } from "../../services/email/send-email";
import { renderPasswordResetEmail } from "../../services/email/templates/password-reset";
import { renderEmailVerificationEmail } from "../../services/email/templates/email-verification";

const ForgotPasswordSchema = z.object({
  email: z.string().email().max(200).toLowerCase().trim(),
});

const GENERIC_OK_RESPONSE = { success: true } as const;

function buildResetUrl(origin: string, oobCode: string): string {
  return `${origin}/reset?code=${encodeURIComponent(oobCode)}`;
}

function buildVerifyUrl(origin: string, oobCode: string): string {
  return `${origin}/verify?code=${encodeURIComponent(oobCode)}`;
}

function extractOobCode(actionLink: string): string | null {
  try {
    return new URL(actionLink).searchParams.get("oobCode");
  } catch {
    return null;
  }
}

export async function requestPasswordReset(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = ForgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(200).json(GENERIC_OK_RESPONSE);
    return;
  }

  const { email } = parsed.data;
  const origin = resolveTrustedRequestOrigin(req);

  try {
    const actionLink = await auth.generatePasswordResetLink(email, {
      url: `${origin}/login`,
      handleCodeInApp: false,
    });

    const oobCode = extractOobCode(actionLink);
    if (!oobCode) {
      logger.error("[auth] generatePasswordResetLink returned link without oobCode");
      res.status(200).json(GENERIC_OK_RESPONSE);
      return;
    }

    const resetUrl = buildResetUrl(origin, oobCode);
    const { subject, html, text } = renderPasswordResetEmail({
      email,
      resetUrl,
    });

    const result = await sendEmail({
      to: email,
      subject,
      html,
      text,
      type: "password_reset",
    });

    if (!result.ok) {
      logger.error("[auth] password reset email send failed", {
        error: result.error,
      });
    } else {
      logger.info("[auth] password reset email sent", {
        messageId: result.messageId,
      });
    }
  } catch (err: unknown) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: string }).code)
        : "";
    const message = err instanceof Error ? err.message : String(err);

    // Firebase projects with email enumeration protection enabled return
    // `auth/internal-error: INTERNAL ASSERT FAILED: Unable to create the email
    // action link` instead of `auth/user-not-found`. Treat both as silent
    // no-ops so logs stay clean and the response remains anti-enumeration.
    const isEnumerationProtected =
      code === "auth/internal-error" &&
      /unable to create the email action link/i.test(message);

    if (
      code === "auth/user-not-found" ||
      code === "auth/email-not-found" ||
      isEnumerationProtected
    ) {
      logger.info("[auth] password reset requested for unknown email");
    } else {
      logger.error("[auth] requestPasswordReset failed", {
        code,
        error: message,
      });
    }
  }

  res.status(200).json(GENERIC_OK_RESPONSE);
}

export async function requestEmailVerification(
  req: Request,
  res: Response,
): Promise<void> {
  const uid = req.user?.uid;
  if (!uid) {
    res.status(401).json({ message: "Não autenticado." });
    return;
  }

  let email: string;
  let alreadyVerified: boolean;
  try {
    const userRecord = await auth.getUser(uid);
    if (!userRecord.email) {
      res.status(400).json({ message: "Conta sem email associado." });
      return;
    }
    email = userRecord.email;
    alreadyVerified = userRecord.emailVerified === true;
  } catch (err: unknown) {
    logger.error("[auth] requestEmailVerification failed to load user", {
      uid,
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ message: "Erro ao processar a solicitação." });
    return;
  }

  if (alreadyVerified) {
    res.status(200).json({ success: true, alreadyVerified: true });
    return;
  }

  const origin = resolveTrustedRequestOrigin(req);

  try {
    const actionLink = await auth.generateEmailVerificationLink(email, {
      url: `${origin}/login`,
      handleCodeInApp: false,
    });

    const oobCode = extractOobCode(actionLink);
    if (!oobCode) {
      logger.error(
        "[auth] generateEmailVerificationLink returned link without oobCode",
      );
      res.status(500).json({ message: "Erro ao gerar link de verificação." });
      return;
    }

    const verifyUrl = buildVerifyUrl(origin, oobCode);
    const { subject, html, text } = renderEmailVerificationEmail({
      email,
      verifyUrl,
    });

    const result = await sendEmail({
      to: email,
      subject,
      html,
      text,
      type: "email_verification",
    });

    if (!result.ok) {
      logger.error("[auth] email verification send failed", {
        error: result.error,
      });
      res.status(500).json({ message: "Erro ao enviar email de verificação." });
      return;
    }

    logger.info("[auth] email verification sent", {
      messageId: result.messageId,
    });
    res.status(200).json({ success: true });
  } catch (err: unknown) {
    logger.error("[auth] requestEmailVerification failed", {
      uid,
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ message: "Erro ao processar a solicitação." });
  }
}
