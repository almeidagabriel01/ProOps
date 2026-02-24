export function normalizeOrigin(value: string): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const candidates = /^https?:\/\//i.test(raw)
    ? [raw]
    : [`https://${raw}`, `http://${raw}`];

  for (const candidate of candidates) {
    try {
      return new URL(candidate).origin;
    } catch {
      // try next candidate
    }
  }

  return null;
}

function addOriginWithVariants(target: Set<string>, value: string): void {
  const normalized = normalizeOrigin(value);
  if (!normalized) return;

  target.add(normalized);

  try {
    const parsed = new URL(normalized);
    const hostname = parsed.hostname.toLowerCase();
    const port = parsed.port ? `:${parsed.port}` : "";

    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return;
    }

    if (hostname.startsWith("www.")) {
      const bareHostname = hostname.slice(4);
      if (bareHostname) {
        target.add(`${parsed.protocol}//${bareHostname}${port}`);
      }
      return;
    }

    if (hostname.includes(".")) {
      target.add(`${parsed.protocol}//www.${hostname}${port}`);
    }
  } catch {
    // no-op
  }
}

function parseOrigins(rawValue: string | undefined): Set<string> {
  const parsed = new Set<string>();
  if (!rawValue) return parsed;

  rawValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((value) => {
      addOriginWithVariants(parsed, value);
    });

  return parsed;
}

export function resolveAllowedCorsOrigins(): Set<string> {
  const origins = parseOrigins(process.env.CORS_ALLOWED_ORIGINS);

  [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.NEXT_PUBLIC_VERCEL_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .forEach((value) => {
      addOriginWithVariants(origins, value);
    });

  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
  }

  return origins;
}

export function isProductionRuntime(): boolean {
  return String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
}

export function allowCorsFallbackInCurrentEnvironment(): boolean {
  return (
    !isProductionRuntime() &&
    String(process.env.ALLOW_CORS_FALLBACK || "")
      .trim()
      .toLowerCase() === "true"
  );
}

export function allowsDynamicPreviewOrigins(): boolean {
  const defaultValue = isProductionRuntime() ? "false" : "true";
  return (
    String(process.env.CORS_ALLOW_DYNAMIC_PREVIEW_ORIGINS || defaultValue)
      .trim()
      .toLowerCase() !== "false"
  );
}

export function isDynamicPreviewOrigin(origin: string): boolean {
  if (!allowsDynamicPreviewOrigins()) return false;

  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return (
      hostname.endsWith(".vercel.app") ||
      hostname.endsWith(".web.app") ||
      hostname.endsWith(".firebaseapp.com")
    );
  } catch {
    return false;
  }
}

export type CorsDecision =
  | { allow: true; normalizedOrigin?: string }
  | { allow: false; reason: "invalid_origin" | "allowlist_required" | "origin_not_allowed" };

export function evaluateCorsDecision(input: {
  origin?: string | null;
  allowedOrigins: Set<string>;
  corsFallbackEnabled: boolean;
  productionRuntime: boolean;
}): CorsDecision {
  const origin = String(input.origin || "").trim();
  if (!origin) {
    return { allow: true };
  }

  const normalized = normalizeOrigin(origin);
  if (!normalized) {
    return { allow: false, reason: "invalid_origin" };
  }

  const corsAllowlistMissing = input.allowedOrigins.size === 0;
  if (corsAllowlistMissing && input.productionRuntime) {
    return { allow: false, reason: "allowlist_required" };
  }

  if (
    (corsAllowlistMissing && input.corsFallbackEnabled) ||
    input.allowedOrigins.has(normalized) ||
    isDynamicPreviewOrigin(normalized)
  ) {
    return { allow: true, normalizedOrigin: normalized };
  }

  return { allow: false, reason: "origin_not_allowed" };
}
