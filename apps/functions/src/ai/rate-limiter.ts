/**
 * In-memory rate limiter for the AI chat endpoint.
 *
 * Limits:
 * - 20 requests/minute per user (rolling window)
 * - 5 concurrent SSE connections per tenant
 *
 * Intentionally in-memory (not Redis/Firestore) — Cloud Run scales horizontally
 * but each instance handles its own connections; the SSE cap prevents a single
 * tenant from saturating one instance while the RPM limit prevents burst abuse.
 */

import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

// Rolling window timestamps per user (uid → ms timestamps)
const userWindows = new Map<string, number[]>();
// Active SSE connection count per tenant
const tenantSseCount = new Map<string, number>();

const RATE_LIMIT_RPM = 20; // requests per minute per user
// 20 concurrent SSE connections per tenant — enough for parallel E2E tests (multiple
// spec files each holding 1-2 SSE slots) while still protecting Cloud Run instances.
const MAX_SSE_PER_TENANT = 20;
const WINDOW_MS = 60_000;

// Purge stale window entries every minute to prevent unbounded memory growth
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [uid, timestamps] of userWindows.entries()) {
    const fresh = timestamps.filter((t) => t > cutoff);
    if (fresh.length === 0) userWindows.delete(uid);
    else userWindows.set(uid, fresh);
  }
}, WINDOW_MS);

export function aiRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const user = req.user;
  if (!user?.uid || !user?.tenantId) {
    // Auth missing — let the route handler return 401
    next();
    return;
  }

  const now = Date.now();
  const { uid, tenantId } = user;

  // ── 1. Per-user RPM check ────────────────────────────────────────────────
  const timestamps = userWindows.get(uid) ?? [];
  const recent = timestamps.filter((t) => t > now - WINDOW_MS);
  if (recent.length >= RATE_LIMIT_RPM) {
    logger.warn("AI rate limit exceeded", { uid, tenantId, requestsInWindow: recent.length });
    res.status(429).json({
      message: "Limite de requisições atingido. Aguarde 1 minuto antes de tentar novamente.",
      code: "AI_RATE_LIMIT_EXCEEDED",
    });
    return;
  }
  recent.push(now);
  userWindows.set(uid, recent);

  // ── 2. Per-tenant SSE concurrency check ─────────────────────────────────
  const currentSse = tenantSseCount.get(tenantId) ?? 0;
  if (currentSse >= MAX_SSE_PER_TENANT) {
    logger.warn("AI SSE concurrency limit exceeded", { tenantId, activeSse: currentSse });
    // RPM count is intentionally NOT rolled back: denied requests still count against
    // the quota. This ensures the RPM limit can be reached even when SSE slots are full
    // (e.g., rapid sequential requests where async handlers keep slots open momentarily).
    res.status(429).json({
      message: "Muitas conversas simultâneas. Aguarde a conclusão de outra conversa.",
      code: "AI_SSE_LIMIT_EXCEEDED",
    });
    return;
  }

  // Track connection; decrement as soon as the response finishes (finish event)
  // or if the client aborts before the response ends (close event).
  // Using a flag prevents double-decrement when both events fire.
  tenantSseCount.set(tenantId, currentSse + 1);
  let decremented = false;
  const safeDecrement = () => {
    if (decremented) return;
    decremented = true;
    const count = tenantSseCount.get(tenantId) ?? 0;
    if (count <= 1) tenantSseCount.delete(tenantId);
    else tenantSseCount.set(tenantId, count - 1);
  };
  res.once("finish", safeDecrement);
  res.once("close", safeDecrement);

  next();
}
