import { Request, Response, NextFunction } from "express";
import { captureError } from "../../lib/observability/error-logger";

export const EXCLUDED_PREFIXES = ["/v1/observability", "/internal", "/health", "/api/health"];

function isExcluded(path: string): boolean {
  return EXCLUDED_PREFIXES.some((p) => path === p || path.startsWith(p + "/") || path.startsWith(p));
}

/**
 * Only server errors (5xx) are real issues for the observability pipeline.
 * Expected 4xx client errors (validation, auth, not-found, rate-limit) are
 * normal request outcomes already returned to the client with a message, and
 * auth/rate-limit anomalies have their own security pipeline
 * (security_audit_events / security_metrics). Capturing them here is noise.
 */
export function shouldCaptureResponseStatus(status: number): boolean {
  return status >= 500;
}

/**
 * Captures every server-error response (5xx) that was NOT already fed to the
 * observability pipeline by the global error handler (which sets
 * res.locals.__obsCaptured). Covers handlers that res.status(5xx) without
 * throwing. Best-effort, never blocks the response.
 */
export function captureResponseErrors(req: Request, res: Response, next: NextFunction): void {
  res.on("finish", () => {
    try {
      if (!shouldCaptureResponseStatus(res.statusCode)) return;
      if ((res.locals as { __obsCaptured?: boolean })?.__obsCaptured === true) return;
      if (isExcluded(req.path)) return;
      const user = req.user as { uid?: string; tenantId?: string } | undefined;
      const synthetic = {
        name: "HttpError",
        message: `HTTP ${res.statusCode} ${req.method} ${req.path}`,
      };
      void captureError(synthetic, {
        source: "functions",
        route: req.path,
        method: req.method,
        status: res.statusCode,
        uid: user?.uid ?? null,
        tenantId: user?.tenantId ?? null,
        handled: true,
      });
    } catch {
      // best-effort
    }
  });
  next();
}
