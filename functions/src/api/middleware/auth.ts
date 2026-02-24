import { Request, Response, NextFunction } from "express";
import {
  AuthContext,
  resolveAuthContextFromRequest,
  shouldRequireStrictClaimsInMiddleware,
} from "../../lib/auth-context";
import {
  buildSecurityLogContext,
  incrementSecurityCounter,
  logSecurityEvent,
  writeSecurityAuditEvent,
} from "../../lib/security-observability";

function getAuthErrorStatus(errorMessage: string): number {
  if (errorMessage === "UNAUTHENTICATED") return 401;
  if (errorMessage.startsWith("AUTH_CLAIMS_MISSING_")) return 403;
  if (errorMessage.startsWith("FORBIDDEN_")) return 403;
  if (errorMessage.startsWith("auth/")) return 401;
  return 403;
}

function getAuthErrorMessage(errorMessage: string): string {
  if (errorMessage === "UNAUTHENTICATED") return "Unauthorized";
  if (errorMessage === "FORBIDDEN_TENANT_MISMATCH") {
    return "Forbidden: tenant mismatch";
  }
  if (errorMessage.startsWith("AUTH_CLAIMS_MISSING_")) {
    return "Unauthorized: missing authorization claims";
  }
  return "Unauthorized";
}

// Extend Express Request type to include current auth context.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthContext;
      requestId?: string;
    }
  }
}

export const validateFirebaseIdToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.method === "OPTIONS") {
    return next();
  }

  // Shared links are intentionally public.
  if (req.path.startsWith("/v1/share/") || req.path.startsWith("/share/")) {
    return next();
  }

  try {
    const requireStrictClaims = shouldRequireStrictClaimsInMiddleware();
    const authContext = await resolveAuthContextFromRequest(req, {
      requireStrictClaims,
    });

    req.user = authContext;

    if (!authContext.hasRequiredClaims) {
      const context = buildSecurityLogContext(req, {
        uid: authContext.uid,
        tenantId: authContext.tenantId,
        route: req.path,
        status: 200,
        source: "auth_middleware",
        reason: "missing_role_or_tenant_claims",
      });
      logSecurityEvent("AUTH_COMPAT", context, "WARN");
      void incrementSecurityCounter("AUTH_COMPAT", context);
      void writeSecurityAuditEvent({
        eventType: "AUTH_COMPAT",
        requestId: context.requestId,
        route: context.route,
        status: context.status,
        tenantId: context.tenantId,
        uid: context.uid,
        reason: context.reason,
        source: context.source,
      });
    }

    return next();
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNAUTHENTICATED";
    const context = buildSecurityLogContext(req, {
      route: req.path,
      status: getAuthErrorStatus(message),
      source: "auth_middleware",
      reason: message,
    });

    if (message === "AUTH_CLAIMS_MISSING_ROLE") {
      void incrementSecurityCounter("AUTH_CLAIMS_MISSING_ROLE", context);
    }
    if (message === "AUTH_CLAIMS_MISSING_TENANT") {
      void incrementSecurityCounter("AUTH_CLAIMS_MISSING_TENANT", context);
    }
    if (message === "FORBIDDEN_TENANT_MISMATCH") {
      void incrementSecurityCounter("FORBIDDEN_TENANT_MISMATCH", context);
    }

    if (
      message === "AUTH_CLAIMS_MISSING_ROLE" ||
      message === "AUTH_CLAIMS_MISSING_TENANT" ||
      message === "FORBIDDEN_TENANT_MISMATCH"
    ) {
      void writeSecurityAuditEvent({
        eventType: message,
        requestId: context.requestId,
        route: context.route,
        status: context.status,
        tenantId: context.tenantId,
        uid: context.uid,
        reason: context.reason,
        source: context.source,
      });
    }

    logSecurityEvent("auth_verification_failed", context, "WARN");
    return res
      .status(getAuthErrorStatus(message))
      .send(getAuthErrorMessage(message));
  }
};
