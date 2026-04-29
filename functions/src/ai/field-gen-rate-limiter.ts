import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

// Rolling window timestamps per user for field generation (separate from chat)
const userWindows = new Map<string, number[]>();

const RATE_LIMIT_RPH = 30; // requests per hour per user
const WINDOW_MS = 60 * 60_000; // 1 hour

setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [uid, timestamps] of userWindows.entries()) {
    const fresh = timestamps.filter((t) => t > cutoff);
    if (fresh.length === 0) userWindows.delete(uid);
    else userWindows.set(uid, fresh);
  }
}, WINDOW_MS);

export function fieldGenRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const user = req.user;
  if (!user?.uid || !user?.tenantId) {
    next();
    return;
  }

  const now = Date.now();
  const { uid, tenantId } = user;

  const timestamps = userWindows.get(uid) ?? [];
  const recent = timestamps.filter((t) => t > now - WINDOW_MS);
  if (recent.length >= RATE_LIMIT_RPH) {
    const oldestInWindow = recent[0];
    const retryAfterSec = Math.ceil((oldestInWindow + WINDOW_MS - now) / 1000);
    logger.warn("AI field-gen rate limit exceeded", { uid, tenantId, requestsInWindow: recent.length });
    res.status(429).json({
      message: `Muitas requisições. Aguarde ${retryAfterSec} segundos antes de tentar novamente.`,
      code: "AI_RATE_LIMIT_EXCEEDED",
      retryAfterSeconds: retryAfterSec,
    });
    return;
  }
  recent.push(now);
  userWindows.set(uid, recent);
  next();
}
