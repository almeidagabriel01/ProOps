import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";
import { createRateLimiter } from "../lib/rate-limit/express-limiter";
import type { RateLimitDecision } from "../lib/rate-limit/types";

/**
 * Rate limiter da geração de campo por AI (30/hora por usuário), sobre o
 * store plugável de lib/rate-limit (memory por default; distribuído quando
 * RATE_LIMIT_STORE=redis). Chamadas Gemini são pagas por token — nunca
 * remover este limiter.
 */

const RATE_LIMIT_RPH = 30;
const WINDOW_MS = 60 * 60_000;

function onFieldGenLimit(
  req: Request,
  res: Response,
  decision: RateLimitDecision,
): void {
  const retryAfterSec = Math.max(1, decision.retryAfterSeconds);
  logger.warn("AI field-gen rate limit exceeded", {
    uid: req.user?.uid,
    tenantId: req.user?.tenantId,
    requestsInWindow: decision.current,
  });
  res.status(429).json({
    message: `Muitas requisições. Aguarde ${retryAfterSec} segundos antes de tentar novamente.`,
    code: "AI_RATE_LIMIT_EXCEEDED",
    retryAfterSeconds: retryAfterSec,
  });
}

const limiter = createRateLimiter({
  maxRequests: RATE_LIMIT_RPH,
  windowMs: WINDOW_MS,
  keyPrefix: "ai-fieldgen",
  keyResolver: (req) => String(req.user?.uid || "anon"),
  onLimit: onFieldGenLimit,
});

export function fieldGenRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user?.uid || !req.user?.tenantId) {
    // Auth ausente — deixa a rota devolver 401
    next();
    return;
  }
  void limiter(req, res, next);
}
