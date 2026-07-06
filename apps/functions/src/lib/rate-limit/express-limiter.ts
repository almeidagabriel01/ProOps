import type express from "express";
import { createRateLimitStore } from "./factory";
import { resolveEffectiveRateLimitMax } from "./emulator";
import type { RateLimitDecision } from "./types";
import {
  buildSecurityLogContext,
  incrementSecurityCounter,
  logSecurityEvent,
  writeSecurityAuditEvent,
} from "../security-observability";

/**
 * Middleware Express de rate limiting sobre o store plugável
 * (memory por default; Upstash Redis via RATE_LIMIT_STORE=redis — ver
 * lib/rate-limit/factory.ts). Extraído de api/index.ts para ser reutilizado
 * pelos limiters de PDF/AI e por apps Express fora do monolito (ex.: pdfApp).
 *
 * Fail-open: erro no store loga ratelimit_store_error_allowing_request e
 * deixa a request passar — indisponibilidade do Redis nunca derruba a API.
 */

const DEFAULT_WINDOW_MS = 60_000;

const rateLimitStore = createRateLimitStore();

export function getClientIp(req: express.Request): string {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }
  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return String(forwardedFor[0] || "").trim();
  }
  return req.ip || "unknown";
}

export function sanitizeLoggedPath(path: string): string {
  if (path.startsWith("/v1/share/transaction/")) {
    return "/v1/share/transaction/:token";
  }
  if (path.startsWith("/v1/share/")) {
    return "/v1/share/:token";
  }
  return path;
}

export function buildRateLimitIdentity(req: express.Request): string {
  const uid = String(req.user?.uid || "anonymous");
  const tenantId = String(req.user?.tenantId || "no-tenant");
  return `${getClientIp(req)}:${uid}:${tenantId}`;
}

export type RateLimiterOptions = {
  maxRequests: number;
  windowMs?: number;
  keyPrefix: string;
  keyResolver?: (req: express.Request) => string;
  /**
   * Resposta customizada ao exceder o limite. Default: Retry-After +
   * 429 {message:"Too many requests"} + eventos de segurança.
   */
  onLimit?: (
    req: express.Request,
    res: express.Response,
    decision: RateLimitDecision,
  ) => void;
  /**
   * true (default): dentro de emulador Firebase o limite sobe para um teto
   * inofensivo (resolveEffectiveRateLimitMax) para dev local e E2E.
   * false: limite vale também no emulador (ex.: PDF, cujo E2E depende do 429).
   */
  emulatorBypass?: boolean;
};

function defaultOnLimit(
  req: express.Request,
  res: express.Response,
  decision: RateLimitDecision,
  keyPrefix: string,
): void {
  const route = sanitizeLoggedPath(req.path);
  res.set("Retry-After", String(Math.max(decision.retryAfterSeconds, 1)));
  const context = buildSecurityLogContext(req, {
    route,
    status: 429,
    reason: "rate_limit_exceeded",
    source: keyPrefix,
    ip: getClientIp(req),
  });
  logSecurityEvent("ratelimit_triggered", context, "WARN");
  void incrementSecurityCounter("ratelimit_triggered", context);
  void writeSecurityAuditEvent({
    eventType: "ratelimit_triggered",
    requestId: context.requestId,
    route: context.route,
    status: context.status,
    tenantId: context.tenantId,
    uid: context.uid,
    reason: context.reason,
    source: context.source,
  });
  res.status(429).json({ message: "Too many requests" });
}

export function createRateLimiter(
  options: RateLimiterOptions,
): express.RequestHandler {
  const windowMs = options.windowMs || DEFAULT_WINDOW_MS;
  const emulatorBypass = options.emulatorBypass !== false;
  const effectiveMax = emulatorBypass
    ? resolveEffectiveRateLimitMax(options.maxRequests)
    : options.maxRequests;

  return async (req, res, next) => {
    const route = sanitizeLoggedPath(req.path);
    const keyId = options.keyResolver
      ? options.keyResolver(req)
      : buildRateLimitIdentity(req);
    const rateKey = `${options.keyPrefix}:${keyId}`;

    try {
      const decision = await rateLimitStore.consume(
        rateKey,
        effectiveMax,
        windowMs,
      );

      if (decision.allowed) {
        return next();
      }

      if (options.onLimit) {
        return options.onLimit(req, res, decision);
      }
      return defaultOnLimit(req, res, decision, options.keyPrefix);
    } catch (error) {
      const context = buildSecurityLogContext(req, {
        route,
        status: 200,
        reason:
          error instanceof Error ? error.message : "ratelimit_store_failure",
        source: options.keyPrefix,
        ip: getClientIp(req),
      });
      logSecurityEvent(
        "ratelimit_store_error_allowing_request",
        context,
        "WARN",
      );
      return next();
    }
  };
}
