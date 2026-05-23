import type { Request } from "express";
import {
  allowCorsFallbackInCurrentEnvironment,
  evaluateCorsDecision,
  isProductionRuntime,
  normalizeOrigin,
  resolveAllowedCorsOrigins,
} from "../api/security/cors-policy";
import { resolveFrontendAppOrigin } from "./frontend-app-url";

function readHeader(req: Request, name: string): string {
  const value = req.headers[name];
  if (Array.isArray(value)) return String(value[0] || "").trim();
  return String(value || "").trim();
}

function buildOriginFromForwardedHeaders(req: Request): string | null {
  const host = readHeader(req, "x-forwarded-host") || readHeader(req, "host");
  if (!host) return null;

  let proto = readHeader(req, "x-forwarded-proto").toLowerCase();
  if (!proto) {
    proto = host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https";
  }

  return normalizeOrigin(`${proto}://${host}`);
}

/**
 * Resolves the origin of the frontend app for the current request, suitable
 * for composing transactional email links. Trusts only origins that pass the
 * same CORS allow-list check used to admit the request itself, so a forged
 * `x-forwarded-host` cannot redirect the link to an attacker-controlled host.
 *
 * Order of preference:
 *   1. Request `Origin` header (set by the browser) if allowed by CORS policy
 *   2. `x-forwarded-host` + `x-forwarded-proto` from the Next.js proxy, if allowed
 *   3. Fallback to `resolveFrontendAppOrigin()` (env-driven, hardcoded defaults)
 */
export function resolveTrustedRequestOrigin(req: Request): string {
  const allowedOrigins = resolveAllowedCorsOrigins();
  const corsFallbackEnabled = allowCorsFallbackInCurrentEnvironment();
  const productionRuntime = isProductionRuntime();

  const candidates: string[] = [];
  const headerOrigin = readHeader(req, "origin");
  if (headerOrigin) candidates.push(headerOrigin);
  const forwardedOrigin = buildOriginFromForwardedHeaders(req);
  if (forwardedOrigin) candidates.push(forwardedOrigin);

  for (const candidate of candidates) {
    const decision = evaluateCorsDecision({
      origin: candidate,
      allowedOrigins,
      corsFallbackEnabled,
      productionRuntime,
    });
    if (decision.allow && decision.normalizedOrigin) {
      return decision.normalizedOrigin;
    }
  }

  return resolveFrontendAppOrigin();
}
