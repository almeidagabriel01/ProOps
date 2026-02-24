import { Request, Response } from "express";
import axios from "axios";
import {
  parseCommaSeparatedHosts,
  validateOutboundUrl,
} from "../security/url-security";

const DEFAULT_USER_AGENT =
  "TemplateERP-ProxyImage/1.0 (+https://proops.com.br)";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 8000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 300;
const DEFAULT_PROXY_ALLOWED_HOSTS = [
  "firebasestorage.googleapis.com",
  "firebasestorage.app",
  "storage.googleapis.com",
];

const ALLOWED_IMAGE_CONTENT_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const RATE_LIMIT_STATE = new Map<string, { count: number; windowStart: number }>();
const configuredProxyHosts = parseCommaSeparatedHosts(
  process.env.PROXY_IMAGE_ALLOWED_HOSTS,
);
const PROXY_ALLOWED_HOSTS =
  configuredProxyHosts.length > 0
    ? configuredProxyHosts
    : DEFAULT_PROXY_ALLOWED_HOSTS;
const PROXY_ALLOWED_ORIGINS = resolveAllowedOrigins();

function isProductionRuntime(): boolean {
  return String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
}

function allowCorsFallbackInCurrentEnvironment(): boolean {
  return (
    !isProductionRuntime() &&
    String(process.env.ALLOW_CORS_FALLBACK || "")
      .trim()
      .toLowerCase() === "true"
  );
}

function getCacheControl(req: Request): string {
  const isCaptureMode = req.query.capture === "1";
  const disableCache = req.query.noStore === "1";
  return isCaptureMode || disableCache
    ? "no-store, max-age=0"
    : "public, max-age=3600";
}

function normalizeOrigin(value: string): string | null {
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

function parseAllowedOrigins(rawValue: string | undefined): Set<string> {
  const allowedOrigins = new Set<string>();
  if (!rawValue) return allowedOrigins;

  rawValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((value) => {
      addOriginWithVariants(allowedOrigins, value);
    });

  return allowedOrigins;
}

function resolveAllowedOrigins(): Set<string> {
  const origins = parseAllowedOrigins(
    process.env.PROXY_IMAGE_ALLOWED_ORIGINS || process.env.CORS_ALLOWED_ORIGINS,
  );
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
    origins.add("http://localhost:5000");
    origins.add("http://127.0.0.1:5000");
  }

  return origins;
}

function allowsDynamicPreviewOrigins(): boolean {
  const defaultValue = isProductionRuntime() ? "false" : "true";
  return (
    String(process.env.CORS_ALLOW_DYNAMIC_PREVIEW_ORIGINS || defaultValue)
      .trim()
      .toLowerCase() !== "false"
  );
}

function isDynamicPreviewOrigin(origin: string): boolean {
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

function applySecurityHeaders(req: Request, res: Response): boolean {
  const requestOrigin = req.get("origin");
  const normalizedOrigin = requestOrigin ? normalizeOrigin(requestOrigin) : null;
  const corsAllowlistMissing = PROXY_ALLOWED_ORIGINS.size === 0;
  const corsFallbackEnabled = allowCorsFallbackInCurrentEnvironment();
  const isOriginAllowed = normalizedOrigin
    ? ((corsAllowlistMissing && corsFallbackEnabled) ||
      PROXY_ALLOWED_ORIGINS.has(normalizedOrigin) ||
      isDynamicPreviewOrigin(normalizedOrigin))
    : true;

  const shouldDenyOrigin =
    Boolean(normalizedOrigin) &&
    (isProductionRuntime() ? corsAllowlistMissing || !isOriginAllowed : !isOriginAllowed);

  if (normalizedOrigin && !shouldDenyOrigin) {
    res.set("Access-Control-Allow-Origin", normalizedOrigin);
    res.set("Vary", "Origin");
  } else {
    res.removeHeader("Access-Control-Allow-Origin");
    res.removeHeader("Vary");
  }

  const isNoStore = req.query.capture === "1" || req.query.noStore === "1";
  if (isNoStore) {
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
  }

  res.set("X-Content-Type-Options", "nosniff");
  return !shouldDenyOrigin;
}

function getClientIp(req: Request): string {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return String(forwardedFor[0] || "").trim();
  }

  return req.ip || "unknown";
}

function isRateLimited(req: Request, res: Response): boolean {
  const now = Date.now();
  if (RATE_LIMIT_STATE.size > 5000) {
    RATE_LIMIT_STATE.forEach((entry, entryKey) => {
      if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
        RATE_LIMIT_STATE.delete(entryKey);
      }
    });
  }

  const key = getClientIp(req);
  const current = RATE_LIMIT_STATE.get(key);

  if (!current || now - current.windowStart >= RATE_LIMIT_WINDOW_MS) {
    RATE_LIMIT_STATE.set(key, { count: 1, windowStart: now });
    return false;
  }

  current.count += 1;
  RATE_LIMIT_STATE.set(key, current);

  if (current.count <= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  const retryAfterSeconds = Math.ceil(
    (RATE_LIMIT_WINDOW_MS - (now - current.windowStart)) / 1000,
  );
  res.set("Retry-After", String(Math.max(retryAfterSeconds, 1)));
  return true;
}

type ProxyFetchResult =
  | { ok: true; buffer: Buffer; contentType: string }
  | { ok: false; statusCode: number; message: string };

async function fetchRemoteImage(imageUrl: string): Promise<ProxyFetchResult> {
  const validation = await validateOutboundUrl(imageUrl, {
    allowedHosts: PROXY_ALLOWED_HOSTS,
    allowHttp: process.env.PROXY_IMAGE_ALLOW_HTTP === "true",
    allowLocalAddresses: process.env.PROXY_IMAGE_ALLOW_LOCAL === "true",
    maxUrlLength: 2048,
  });

  if (!validation.ok) {
    return {
      ok: false,
      statusCode: validation.statusCode,
      message: validation.reason,
    };
  }

  try {
    const response = await axios.get<ArrayBuffer>(validation.normalizedUrl, {
      responseType: "arraybuffer",
      timeout: REQUEST_TIMEOUT_MS,
      maxContentLength: MAX_IMAGE_BYTES,
      maxBodyLength: MAX_IMAGE_BYTES,
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 300,
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        Accept: "image/*",
      },
    });

    const contentTypeHeader = response.headers["content-type"];
    const contentTypeValue = Array.isArray(contentTypeHeader)
      ? contentTypeHeader[0]
      : contentTypeHeader;
    const normalizedContentType = String(contentTypeValue || "")
      .split(";")[0]
      .trim()
      .toLowerCase();

    if (!ALLOWED_IMAGE_CONTENT_TYPES.has(normalizedContentType)) {
      return {
        ok: false,
        statusCode: 415,
        message: "URL does not point to a supported image type",
      };
    }

    const buffer = Buffer.from(response.data);
    if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
      return {
        ok: false,
        statusCode: 413,
        message: "Image exceeds size limit",
      };
    }

    return {
      ok: true,
      buffer,
      contentType: normalizedContentType,
    };
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      if (error.code === "ECONNABORTED") {
        return { ok: false, statusCode: 504, message: "Upstream timeout" };
      }

      const status = error.response?.status;
      if (status && [301, 302, 303, 307, 308].includes(status)) {
        return { ok: false, statusCode: 400, message: "Redirects are not allowed" };
      }

      if (status === 404) {
        return { ok: false, statusCode: 404, message: "Image not found" };
      }
    }

    return { ok: false, statusCode: 502, message: "Failed to fetch remote image" };
  }
}

export const proxyImage = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const canServeOrigin = applySecurityHeaders(req, res);
    if (!canServeOrigin) {
      return res.status(403).send("Origin not allowed");
    }

    if (isRateLimited(req, res)) {
      return res.status(429).send("Too many requests.");
    }

    const imageUrl = typeof req.query.url === "string" ? req.query.url : "";
    if (!imageUrl) {
      return res.status(400).send("URL parameter is required.");
    }

    const cacheControl = getCacheControl(req);
    const remoteImage = await fetchRemoteImage(imageUrl);

    if (!remoteImage.ok) {
      return res.status(remoteImage.statusCode).send(remoteImage.message);
    }

    res.set("Content-Type", remoteImage.contentType);
    res.set("Content-Length", String(remoteImage.buffer.length));
    res.set("Cache-Control", cacheControl);
    return res.send(remoteImage.buffer);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Error proxying image.";
    console.error("Error proxying image:", message);
    return res.status(500).send("Error proxying image.");
  }
};
