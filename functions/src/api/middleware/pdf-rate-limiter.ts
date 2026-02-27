import { Request, Response, NextFunction } from "express";

/**
 * In-memory rate limiter for PDF generation endpoints.
 *
 * Limitação por usuário autenticado (uid) + IP para prevenir abuso.
 * Cada requisição abre um browser Chromium headless — sem limitação,
 * um atacante autenticado poderia exaurir os recursos do Cloud Function.
 *
 * NOTA DE DISTRIBUIÇÃO: Em ambientes com múltiplas instâncias (Cloud Functions
 * com scale > 1), o controle é por instância. Para enforcement global use
 * Firebase App Check ou Cloud Armor. Para a maioria dos casos (PDF sob demanda)
 * essa limitação por instância já é suficientemente protetora.
 */

const WINDOW_MS = 60_000; // 1 minuto
const MAX_REQUESTS_PER_WINDOW = 5; // 5 PDFs por minuto por usuário/IP

// Mapa chave → lista de timestamps dentro da janela deslizante
const requestLog = new Map<string, number[]>();

/**
 * Deriva a chave de rate limit da request:
 * - Usuário autenticado: uid (mais preciso)
 * - Fallback para IP quando uid não disponível (endpoints públicos com token)
 */
function deriveKey(req: Request): string {
  const uid = req.user?.uid;
  if (uid) return `uid:${uid}`;

  // Para endpoints públicos o token já é o "auth" — usamos IP como proxy
  const forwarded = req.headers["x-forwarded-for"];
  const rawIp =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    "unknown";

  return `ip:${rawIp}`;
}

// Limpeza periódica para evitar crescimento ilimitado em instâncias longas.
// `.unref()` garante que o setInterval não impede o processo de sair.
const cleanupTimer = setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [key, timestamps] of requestLog.entries()) {
    const remaining = timestamps.filter((t) => t > cutoff);
    if (remaining.length === 0) {
      requestLog.delete(key);
    } else {
      requestLog.set(key, remaining);
    }
  }
}, WINDOW_MS);

if (typeof cleanupTimer.unref === "function") {
  cleanupTimer.unref();
}

export function pdfRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const key = deriveKey(req);

  // Filtra timestamps antigos (janela deslizante)
  const recent = (requestLog.get(key) || []).filter((t) => t > cutoff);

  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    // Calcula quando a janela vai liberar baseado no timestamp mais antigo
    const oldestTs = recent[0];
    const retryAfterMs = WINDOW_MS - (now - oldestTs);
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.status(429).json({
      code: "PDF_RATE_LIMIT_EXCEEDED",
      message: "Muitas requisições de PDF. Aguarde alguns instantes e tente novamente.",
      retryAfter: retryAfterSeconds,
    });
    return;
  }

  recent.push(now);
  requestLog.set(key, recent);
  next();
}
