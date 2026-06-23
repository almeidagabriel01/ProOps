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

/**
 * Stringify a non-Error, non-primitive value without ever throwing and without
 * collapsing to the useless "[object Object]". Falls back to String(v) only when
 * JSON.stringify yields nothing meaningful (circular refs, empty object, etc.).
 */
function safeStringify(v: unknown): string {
  try {
    const json = JSON.stringify(v);
    if (json && json !== "{}" && json !== "[]") return json;
  } catch {
    // circular or non-serializable — fall through
  }
  return String(v);
}

/**
 * Normalize any thrown value into a stable { errorType, message, stack } shape.
 * Handles three shapes: native Error, plain object carrying name/message/stack
 * fields (e.g. the synthetic HttpError from error-response-capture), and
 * primitives. Never throws.
 */
function normalizeThrowable(err: unknown): {
  errorType: string;
  message: string;
  stack: string | null;
} {
  if (err instanceof Error) {
    return { errorType: err.name || "Error", message: err.message, stack: err.stack ?? null };
  }
  if (err && typeof err === "object") {
    return {
      errorType: readField(err, "name") ?? "Error",
      message: readField(err, "message") ?? safeStringify(err),
      stack: readField(err, "stack"),
    };
  }
  return { errorType: "Error", message: String(err), stack: null };
}

export function toIngestInput(err: unknown, ctx: CaptureCtx): IngestErrorInput {
  const normalized = normalizeThrowable(err);
  return {
    errorType: normalized.errorType,
    message: normalized.message,
    stack: normalized.stack,
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
