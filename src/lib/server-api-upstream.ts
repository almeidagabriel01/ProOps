import "server-only";

import type { NextRequest } from "next/server";

const FUNCTIONS_REGION = "southamerica-east1";
const DEV_PROJECT_ID = "erp-softcode";
const PROD_PROJECT_ID = "erp-softcode-prod";
const LOCAL_UPSTREAM = `http://127.0.0.1:5001/${DEV_PROJECT_ID}/${FUNCTIONS_REGION}/api`;
const DEV_UPSTREAM = `https://${FUNCTIONS_REGION}-${DEV_PROJECT_ID}.cloudfunctions.net/api`;
const PROD_UPSTREAM = `https://${FUNCTIONS_REGION}-${PROD_PROJECT_ID}.cloudfunctions.net/api`;
const PRODUCTION_HOSTS = new Set(["proops.com.br", "www.proops.com.br"]);
const ALLOWED_UPSTREAMS = new Set([LOCAL_UPSTREAM, DEV_UPSTREAM, PROD_UPSTREAM]);

export type UpstreamTarget = {
  baseUrl: string;
  target: "local" | "dev" | "prod";
};

function normalizeUrl(value: string): string {
  return String(value || "").trim().replace(/\/+$/, "");
}

function getValidatedOverride(
  value: string | undefined,
  fallback: string,
): string {
  const normalized = normalizeUrl(value || "");
  if (!normalized) {
    return fallback;
  }

  if (!ALLOWED_UPSTREAMS.has(normalized)) {
    throw new Error(`Invalid API upstream override: ${normalized}`);
  }

  return normalized;
}

function getHostFromRequest(req: NextRequest): string {
  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = forwardedHost || req.headers.get("host") || req.nextUrl.host;
  return String(host || "")
    .trim()
    .split(",")[0]
    .trim()
    .split(":")[0]
    .toLowerCase();
}

export function resolveFunctionsApiUpstream(req: NextRequest): UpstreamTarget {
  const host = getHostFromRequest(req);
  const isLocalHost = host === "localhost" || host === "127.0.0.1";

  if (isLocalHost) {
    return {
      baseUrl: getValidatedOverride(process.env.FUNCTIONS_LOCAL_API_URL, LOCAL_UPSTREAM),
      target: "local",
    };
  }

  if (PRODUCTION_HOSTS.has(host)) {
    return {
      baseUrl: getValidatedOverride(process.env.FUNCTIONS_PROD_API_URL, PROD_UPSTREAM),
      target: "prod",
    };
  }

  return {
    baseUrl: getValidatedOverride(process.env.FUNCTIONS_DEV_API_URL, DEV_UPSTREAM),
    target: "dev",
  };
}
