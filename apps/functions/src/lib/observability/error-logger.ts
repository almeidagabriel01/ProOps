import { ingestError } from "./error-ingest.service";
import type { IngestErrorInput, ErrorSource } from "../../shared/error-observability.types";

interface CaptureCtx {
  source: ErrorSource;
  route?: string | null;
  method?: string | null;
  status?: number | null;
  uid?: string | null;
  tenantId?: string | null;
  userAgent?: string | null;
  handled: boolean;
}

function readField(err: unknown, key: string): string | null {
  if (err && typeof err === "object" && key in err) {
    const v = (err as Record<string, unknown>)[key];
    return typeof v === "string" && v.trim() ? v : null;
  }
  return null;
}

export function toIngestInput(err: unknown, ctx: CaptureCtx): IngestErrorInput {
  const isError = err instanceof Error;
  return {
    errorType: isError ? err.name || "Error" : "Error",
    message: isError ? err.message : String(err),
    stack: isError ? err.stack ?? null : null,
    source: ctx.source,
    route: ctx.route ?? null,
    method: ctx.method ?? null,
    status: ctx.status ?? null,
    uid: ctx.uid ?? null,
    tenantId: ctx.tenantId ?? null,
    userAgent: ctx.userAgent ?? null,
    why: readField(err, "why"),
    fix: readField(err, "fix"),
    link: readField(err, "link"),
  };
}

/**
 * Capture an error into the observability pipeline. Never throws. The ingest
 * path is intentionally excluded from re-capture (it only console.warns).
 */
export async function captureError(err: unknown, ctx: CaptureCtx): Promise<void> {
  try {
    await ingestError(toIngestInput(err, ctx), { handled: ctx.handled });
  } catch {
    // Swallowed by design — see Global Constraints (self-protection).
  }
}
