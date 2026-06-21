import { Request, Response } from "express";
import { captureError } from "../../lib/observability/error-logger";
import { verifyReportIdentity } from "../../lib/observability/verify-report-identity";
import { logger } from "../../lib/logger";

const MESSAGE_MAX = 2000;
const STACK_MAX = 8000;

export function mapObservabilityErrorStatus(message: string): number {
  if (/inválid|invalid/i.test(message)) return 400;
  return 500;
}

function str(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

/**
 * POST /v1/observability/client-error
 * Body: { errorType?, message, stack?, route?, status? }
 * uid/tenantId are derived from req.user (auth context), never the body.
 */
export async function ingestClientError(req: Request, res: Response): Promise<Response> {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const message = str(body.message, MESSAGE_MAX);
    if (!message) {
      return res.status(400).json({ message: "message inválido" });
    }
    const err = Object.assign(new Error(message), {
      name: str(body.errorType, 200) || "Error",
      stack: str(body.stack, STACK_MAX) || undefined,
    });
    const status = typeof body.status === "number" ? body.status : null;

    const reqUser = req.user as { uid?: string; tenantId?: string } | undefined;
    let uid: string | null = reqUser?.uid ?? null;
    let tenantId: string | null = reqUser?.tenantId ?? null;
    if (!uid) {
      const verified = await verifyReportIdentity((req.body as { idToken?: unknown })?.idToken);
      if (verified) {
        uid = verified.uid;
        tenantId = verified.tenantId;
      }
    }

    void captureError(err, {
      source: "web",
      route: str(body.route, 500),
      method: null,
      status,
      uid,
      tenantId,
      userAgent: str(req.headers["user-agent"], 500),
      handled: true,
    });

    return res.status(202).json({ accepted: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "unexpected";
    logger.warn("observability client-error ingest failed", { error: msg });
    return res.status(mapObservabilityErrorStatus(msg)).json({ message: "Internal server error" });
  }
}
