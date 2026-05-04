import { Request, Response, NextFunction } from "express";
import { createRateLimitStore } from "../../lib/rate-limit/factory";

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;

const store = createRateLimitStore();

function deriveKey(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const rawIp =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    "unknown";
  return `payment_public_ip:${rawIp}`;
}

export async function paymentPublicRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const key = deriveKey(req);
    const decision = await store.consume(key, MAX_REQUESTS_PER_WINDOW, WINDOW_MS);
    if (!decision.allowed) {
      res.setHeader("Retry-After", String(decision.retryAfterSeconds));
      res.status(429).json({
        code: "PAYMENT_RATE_LIMIT_EXCEEDED",
        message: "Muitas tentativas de pagamento. Aguarde um momento e tente novamente.",
        retryAfter: decision.retryAfterSeconds,
      });
      return;
    }
    next();
  } catch {
    // Fail open: se o store falhar, não bloquear o pagamento
    next();
  }
}
