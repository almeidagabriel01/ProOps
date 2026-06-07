import { Request, Response, NextFunction } from "express";
import { logger } from "../../lib/logger";

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const VERIFY_TIMEOUT_MS = 4000;

interface TurnstileVerifyResponse {
  success?: boolean;
  "error-codes"?: string[];
}

function getClientIp(req: Request): string {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }
  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return String(forwardedFor[0] || "").trim();
  }
  return req.ip || "";
}

/**
 * Verifies a Cloudflare Turnstile token on a public endpoint, mitigating
 * account-enumeration abuse of the signup contact-validation oracle.
 *
 * Behavior:
 *  - No `TURNSTILE_SECRET_KEY` configured (local dev / CI / emulator): skipped,
 *    so the form keeps working without keys. The frontend likewise sends no
 *    token when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is unset.
 *  - Token missing or explicitly rejected by Cloudflare: 403 (fail closed).
 *  - Cloudflare unreachable (network/timeout): allowed through (fail open) to
 *    preserve availability — the rate limiter remains the backstop.
 */
export async function verifyTurnstileToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret || process.env.FIRESTORE_EMULATOR_HOST) {
    next();
    return;
  }

  const bodyToken =
    req.body && typeof req.body.captchaToken === "string"
      ? req.body.captchaToken
      : "";
  const token = bodyToken || req.header("cf-turnstile-response") || "";

  if (!token) {
    logger.warn("Turnstile token missing on protected public endpoint", {
      route: req.path,
    });
    res.status(403).json({
      message:
        "Verificação de segurança ausente. Recarregue a página e tente novamente.",
    });
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);

    const params = new URLSearchParams();
    params.set("secret", secret);
    params.set("response", token);
    const ip = getClientIp(req);
    if (ip) {
      params.set("remoteip", ip);
    }

    let data: TurnstileVerifyResponse;
    try {
      const response = await fetch(TURNSTILE_VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
        signal: controller.signal,
      });
      data = (await response.json()) as TurnstileVerifyResponse;
    } finally {
      clearTimeout(timeout);
    }

    if (data.success) {
      next();
      return;
    }

    logger.warn("Turnstile verification failed", {
      route: req.path,
      errorCodes: data["error-codes"],
    });
    res.status(403).json({
      message: "Falha na verificação de segurança. Tente novamente.",
    });
  } catch (error) {
    // Verification service unreachable — fail open so a Cloudflare outage does
    // not block all signups. Rate limiting still applies.
    logger.error("Turnstile verification error (failing open)", {
      route: req.path,
      error: error instanceof Error ? error.message : String(error),
    });
    next();
  }
}
