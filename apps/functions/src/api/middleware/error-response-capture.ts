import { Request, Response, NextFunction } from "express";
import { captureError } from "../../lib/observability/error-logger";

export const EXCLUDED_PREFIXES = ["/v1/observability", "/internal", "/health", "/api/health"];

function isExcluded(path: string): boolean {
  return EXCLUDED_PREFIXES.some((p) => path === p || path.startsWith(p + "/") || path.startsWith(p));
}

/**
 * Captures every response with status >= 400 that was NOT already fed to the
 * observability pipeline by the global error handler (which sets
 * res.locals.__obsCaptured). Covers handlers that res.status(4xx/5xx) without
 * throwing. Best-effort, never blocks the response.
 */
export function captureResponseErrors(req: Request, res: Response, next: NextFunction): void {
  res.on("finish", () => {
    try {
      if (res.statusCode < 400) return;
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
