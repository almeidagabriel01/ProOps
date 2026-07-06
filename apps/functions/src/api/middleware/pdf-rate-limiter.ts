import { Request, Response, NextFunction } from "express";
import { createRateLimiter } from "../../lib/rate-limit/express-limiter";
import type { RateLimitDecision } from "../../lib/rate-limit/types";

/**
 * Rate limiter para endpoints de geração de PDF (5/min por usuário ou IP).
 *
 * Cada requisição pode abrir um Chromium headless — o limite protege
 * CPU/memória da instância. Usa o store plugável de lib/rate-limit
 * (memory por default; distribuído entre instâncias quando
 * RATE_LIMIT_STORE=redis estiver configurado).
 *
 * emulatorBypass: false — o limite vale também no emulador; o E2E depende
 * do contrato 429 + PDF_RATE_LIMIT_EXCEEDED.
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 5;

/**
 * Deriva a chave de rate limit da request:
 * - Usuário autenticado: uid (mais preciso)
 * - Fallback para IP quando uid não disponível (endpoints públicos com token)
 */
function deriveKey(req: Request): string {
  const uid = req.user?.uid;
  if (uid) return `uid:${uid}`;

  const forwarded = req.headers["x-forwarded-for"];
  const rawIp =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    "unknown";

  return `ip:${rawIp}`;
}

function onPdfLimit(
  _req: Request,
  res: Response,
  decision: RateLimitDecision,
): void {
  const retryAfterSeconds = Math.max(1, decision.retryAfterSeconds);
  res.setHeader("Retry-After", String(retryAfterSeconds));
  res.status(429).json({
    code: "PDF_RATE_LIMIT_EXCEEDED",
    message:
      "Muitas requisições de PDF. Aguarde alguns instantes e tente novamente.",
    retryAfter: retryAfterSeconds,
  });
}

const limiter = createRateLimiter({
  maxRequests: MAX_REQUESTS_PER_WINDOW,
  windowMs: WINDOW_MS,
  keyPrefix: "pdf",
  keyResolver: deriveKey,
  onLimit: onPdfLimit,
  emulatorBypass: false,
});

export function pdfRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  void limiter(req, res, next);
}
