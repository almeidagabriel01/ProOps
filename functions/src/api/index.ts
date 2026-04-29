import { onRequest } from "firebase-functions/v2/https";
import express from "express";
import cors from "cors";
import { logger } from "../lib/logger";
import { validateFirebaseIdToken } from "./middleware/auth";
import { CORS_OPTIONS } from "../deploymentConfig";
import { proxyImage } from "./controllers/proxy.controller";

import { coreRoutes } from "./routes/core.routes";
import { financeRoutes } from "./routes/finance.routes";
import { adminRoutes } from "./routes/admin.routes";
import { stripeRoutes, publicStripeRoutes } from "./routes/stripe.routes";
import { auxiliaryRoutes } from "./routes/auxiliary.routes";
import { internalRoutes } from "./routes/internal.routes";
import sharedProposalsRoutes from "./routes/shared-proposals.routes";
import { sharedTransactionsRoutes } from "./routes/shared-transactions.routes";
import notificationsRoutes from "./routes/notifications.routes";
import { whatsappRoutes } from "./routes/whatsapp.routes";
import { kanbanRoutes } from "./routes/kanban.routes";
import { validationRoutes } from "./routes/validation.routes";
import { calendarPublicRoutes, calendarRoutes } from "./routes/calendar.routes";
import { mercadoPagoRoutes } from "./routes/mercadopago.routes";
import { paymentPublicRoutes } from "./routes/payment-public.routes";
import { aiRouter, fieldGenRouter } from "../ai";
import { aiRateLimiter } from "../ai/rate-limiter";
import {
  allowCorsFallbackInCurrentEnvironment,
  evaluateCorsDecision,
  isProductionRuntime,
  resolveAllowedCorsOrigins,
} from "./security/cors-policy";
import { createRateLimitStore } from "../lib/rate-limit/factory";
import {
  attachRequestId,
  buildSecurityLogContext,
  incrementSecurityCounter,
  logSecurityEvent,
  writeSecurityAuditEvent,
} from "../lib/security-observability";
import { runSecretRotationGuard } from "../lib/secret-rotation-guard";

const app = express();

runSecretRotationGuard({ source: "api" });

const DEFAULT_PUBLIC_WINDOW_MS = 60_000;
const DEFAULT_PROTECTED_TIMEOUT_MS = 20_000;
const DEFAULT_PROTECTED_PDF_TIMEOUT_MS = 120_000;
const rateLimitStore = createRateLimitStore();

function getClientIp(req: express.Request): string {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }
  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return String(forwardedFor[0] || "").trim();
  }
  return req.ip || "unknown";
}

function sanitizeLoggedPath(path: string): string {
  if (path.startsWith("/v1/share/transaction/")) {
    return "/v1/share/transaction/:token";
  }
  if (path.startsWith("/v1/share/")) {
    return "/v1/share/:token";
  }
  return path;
}

function buildRateLimitIdentity(req: express.Request): string {
  const uid = String(req.user?.uid || "anonymous");
  const tenantId = String(req.user?.tenantId || "no-tenant");
  return `${getClientIp(req)}:${uid}:${tenantId}`;
}

function resolveProtectedRouteTimeoutMs(req: express.Request): number {
  const originalPath = String(req.originalUrl || req.url || req.path || "")
    .split("?")[0]
    .trim();
  const isProposalPdfRoute = /(?:^|\/)proposals\/[^/]+\/pdf$/.test(
    originalPath,
  );

  if (isProposalPdfRoute) {
    return Number(
      process.env.PROTECTED_PDF_ROUTE_TIMEOUT_MS ||
        DEFAULT_PROTECTED_PDF_TIMEOUT_MS,
    );
  }

  return Number(
    process.env.PROTECTED_ROUTE_TIMEOUT_MS || DEFAULT_PROTECTED_TIMEOUT_MS,
  );
}

function createRateLimiter(options: {
  maxRequests: number;
  windowMs?: number;
  keyPrefix: string;
  keyResolver?: (req: express.Request) => string;
}): express.RequestHandler {
  const windowMs = options.windowMs || DEFAULT_PUBLIC_WINDOW_MS;
  // In the Firebase emulator (FIRESTORE_EMULATOR_HOST is always injected by the
  // emulator process), raise every limiter to a harmless ceiling so the full
  // E2E suite can accumulate requests across specs without hitting fixed-window
  // counters that never reset between specs. This var is NEVER set in Cloud Run.
  const effectiveMax = process.env.FIRESTORE_EMULATOR_HOST
    ? 1_000_000
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

      res.set("Retry-After", String(Math.max(decision.retryAfterSeconds, 1)));
      const context = buildSecurityLogContext(req, {
        route,
        status: 429,
        reason: "rate_limit_exceeded",
        source: options.keyPrefix,
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
      return res.status(429).json({ message: "Too many requests" });
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

const allowedCorsOrigins = resolveAllowedCorsOrigins();
const corsFallbackEnabled = allowCorsFallbackInCurrentEnvironment();
const corsAllowlistMissing = allowedCorsOrigins.size === 0;

if (corsAllowlistMissing && isProductionRuntime()) {
  logSecurityEvent(
    "cors_allowlist_required_missing",
    {
      source: "cors",
      reason: "No allowed origins configured in production",
      status: 403,
    },
    "ERROR",
  );
}

if (corsAllowlistMissing && corsFallbackEnabled) {
  logSecurityEvent(
    "cors_fallback_non_production_enabled",
    {
      source: "cors",
      reason:
        "Using explicit fallback in non-production because ALLOW_CORS_FALLBACK=true",
    },
    "WARN",
  );
}

const publicGeneralLimiter = createRateLimiter({
  keyPrefix: "public-general",
  maxRequests: 300,
});

const publicShareLimiter = createRateLimiter({
  keyPrefix: "public-share",
  maxRequests: 80,
});

const publicWebhookLimiter = createRateLimiter({
  keyPrefix: "public-webhook",
  maxRequests: 180,
});

const protectedLimiter = createRateLimiter({
  keyPrefix: "protected",
  maxRequests: Number(process.env.RATE_LIMIT_PROTECTED_MAX || 240),
  windowMs: Number(process.env.RATE_LIMIT_PROTECTED_WINDOW_MS || 60_000),
  keyResolver: buildRateLimitIdentity,
});

const privilegedLimiter = createRateLimiter({
  keyPrefix: "privileged",
  maxRequests: Number(process.env.RATE_LIMIT_PRIVILEGED_MAX || 120),
  windowMs: Number(process.env.RATE_LIMIT_PRIVILEGED_WINDOW_MS || 60_000),
  keyResolver: buildRateLimitIdentity,
});

const corsMiddleware = cors({
  origin: (origin, callback) => {
    const decision = evaluateCorsDecision({
      origin: origin || null,
      allowedOrigins: allowedCorsOrigins,
      corsFallbackEnabled,
      productionRuntime: isProductionRuntime(),
    });

    if (decision.allow) {
      return callback(null, true);
    }
    return callback(new Error("Origin not allowed by CORS policy"));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Authorization",
    "Content-Type",
    "x-pdf-generator",
    "x-vercel-protection-bypass",
    "x-cron-secret",
    "x-hub-signature-256",
    "stripe-signature",
    "x-request-id",
  ],
  credentials: false,
  maxAge: 60 * 60 * 24,
});

app.use((req, res, next) => {
  const requestId = attachRequestId(req, res);
  const route = sanitizeLoggedPath(req.path);

  logSecurityEvent("request_started", {
    requestId,
    route,
    source: "api",
    ip: getClientIp(req),
  });

  res.on("finish", () => {
    const context = buildSecurityLogContext(req, {
      requestId,
      route,
      status: res.statusCode,
      source: "api",
      ip: getClientIp(req),
    });
    const level = res.statusCode >= 500 ? "ERROR" : "INFO";
    logSecurityEvent("request_finished", context, level);
  });

  next();
});

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");

  const proto = String(req.headers["x-forwarded-proto"] || "").toLowerCase();
  if (proto === "https" || process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }

  if (
    req.path.startsWith("/v1/") &&
    !req.path.startsWith("/v1/share/") &&
    req.path !== "/v1/stripe/plans"
  ) {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("Pragma", "no-cache");
  }

  next();
});

app.use(corsMiddleware);
app.use(
  express.json({
    limit: "1mb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (err?.message === "Origin not allowed by CORS policy") {
      const context = buildSecurityLogContext(req, {
        route: sanitizeLoggedPath(req.path),
        status: 403,
        reason: "origin_not_allowed",
        source: "cors",
        ip: getClientIp(req),
      });
      logSecurityEvent("cors_denied", context, "WARN");
      void incrementSecurityCounter("cors_denied", context);
      void writeSecurityAuditEvent({
        eventType: "cors_denied",
        requestId: context.requestId,
        route: context.route,
        status: context.status,
        tenantId: context.tenantId,
        uid: context.uid,
        reason: context.reason,
        source: context.source,
      });
      return res.status(403).json({ message: "Origin not allowed" });
    }
    return next(err);
  },
);

// Public routes (no authentication required)
app.get(
  "/health",
  publicGeneralLimiter,
  (_req: express.Request, res: express.Response) => {
    res.send("OK");
  },
);

// Proxy image - must be public for PDF generation
app.get("/v1/aux/proxy-image", publicGeneralLimiter, proxyImage);

app.use("/webhooks/whatsapp", publicWebhookLimiter, whatsappRoutes);

// Public Stripe Routes (Plans)
app.use("/v1/stripe", publicGeneralLimiter, publicStripeRoutes);

// Public validation routes (register pre-check)
app.use("/v1/validation", publicGeneralLimiter, validationRoutes);
app.use("/v1", publicGeneralLimiter, calendarPublicRoutes);

// Public shared links
app.use("/v1", publicShareLimiter, sharedProposalsRoutes);
app.use("/v1", publicShareLimiter, sharedTransactionsRoutes);
app.use("/v1", publicShareLimiter, paymentPublicRoutes);

// Protected routes - everything below requires authentication
app.use(validateFirebaseIdToken);
app.use(protectedLimiter);

app.use((req, res, next) => {
  const timeoutMs = resolveProtectedRouteTimeoutMs(req);
  const timeoutHandle = setTimeout(() => {
    if (!res.headersSent) {
      const context = buildSecurityLogContext(req, {
        route: sanitizeLoggedPath(req.path),
        status: 408,
        reason: "protected_route_timeout",
        source: "timeout",
      });
      logSecurityEvent("request_timeout", context, "WARN");
      res.status(408).json({ message: "Request timeout" });
    }
  }, timeoutMs);

  res.on("finish", () => clearTimeout(timeoutHandle));
  res.on("close", () => clearTimeout(timeoutHandle));
  next();
});

// Routes
app.use("/v1", coreRoutes);
app.use("/v1", financeRoutes);
app.use("/v1/admin", privilegedLimiter, adminRoutes);
app.use("/v1/stripe", privilegedLimiter, stripeRoutes);
app.use("/v1/aux", auxiliaryRoutes);
app.use("/v1", kanbanRoutes);
app.use("/v1", calendarRoutes);
app.use("/internal", internalRoutes);
app.use("/v1/notifications", notificationsRoutes);
app.use("/v1", mercadoPagoRoutes);
app.use("/v1/ai", aiRateLimiter, aiRouter);
app.use("/v1/ai", fieldGenRouter);

app.get("/authenticated", (req: express.Request, res: express.Response) => {
  const user = req.user;
  res.json({
    message: `Authenticated as ${user?.uid || "unknown"}`,
    uid: user?.uid || null,
    tenantId: user?.tenantId || null,
    role: user?.role || null,
  });
});

// Global error handler — must be the last middleware registered
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const requestId = (
      req as express.Request & { requestId?: string }
    ).requestId;

    // Emit structured log entry picked up by GCP Cloud Logging
    logger.error("Unhandled Express error", {
      error: err.message,
      stack: err.stack,
      requestId,
      route: sanitizeLoggedPath(req.path),
      method: req.method,
      tenantId: String((req.user as { tenantId?: string })?.tenantId || ""),
      uid: String((req.user as { uid?: string })?.uid || ""),
    });

    if (!res.headersSent) {
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

export const api = onRequest(
  {
    ...CORS_OPTIONS,
    cors: false, // Disable platform-level CORS to use Express middleware
  },
  app,
);
