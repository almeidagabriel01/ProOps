/**
 * Rate limiter do endpoint de chat AI.
 *
 * Duas camadas:
 * - RPM (20 req/min por usuário): store plugável de lib/rate-limit —
 *   memory por default, distribuído entre instâncias quando
 *   RATE_LIMIT_STORE=redis estiver configurado.
 * - SSE (20 conexões simultâneas por tenant): INTENCIONALMENTE in-memory
 *   por instância. Concorrência de conexões abertas é um recurso da
 *   instância (protege o event loop local); contagem distribuída vazaria
 *   slots em crash de instância. Não migrar para o store.
 */

import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";
import { createRateLimiter } from "../lib/rate-limit/express-limiter";

const RATE_LIMIT_RPM = 20; // requests per minute per user
// 20 concurrent SSE connections per tenant — enough for parallel E2E tests (multiple
// spec files each holding 1-2 SSE slots) while still protecting Cloud Run instances.
const MAX_SSE_PER_TENANT = 20;

// Active SSE connection count per tenant (per instance — see header comment)
const tenantSseCount = new Map<string, number>();

const rpmLimiter = createRateLimiter({
  maxRequests: RATE_LIMIT_RPM,
  windowMs: 60_000,
  keyPrefix: "ai-chat",
  keyResolver: (req) => String(req.user?.uid || "anon"),
  onLimit: (req, res, decision) => {
    logger.warn("AI rate limit exceeded", {
      uid: req.user?.uid,
      tenantId: req.user?.tenantId,
      requestsInWindow: decision.current,
    });
    res.status(429).json({
      message:
        "Limite de requisições atingido. Aguarde 1 minuto antes de tentar novamente.",
      code: "AI_RATE_LIMIT_EXCEEDED",
    });
  },
});

export async function aiRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = req.user;
  if (!user?.uid || !user?.tenantId) {
    // Auth missing — let the route handler return 401
    next();
    return;
  }

  const { tenantId } = user;

  // ── 1. Per-user RPM check (pluggable store) ──────────────────────────────
  let rpmAllowed = false;
  await Promise.resolve(
    rpmLimiter(req, res, () => {
      rpmAllowed = true;
    }),
  );
  if (!rpmAllowed) {
    // 429 já respondido pelo onLimit (ou fail-open chamou o next interno).
    return;
  }

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
