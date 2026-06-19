// apps/web/src/lib/observability/report-error.ts

const MESSAGE_MAX = 2000;
const STACK_MAX = 8000;

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

export function buildClientErrorPayload(
  err: unknown,
  ctx?: { route?: string },
): { errorType: string; message: string; stack: string | null; route: string | null; status: number | null } {
  const isError = err instanceof Error;
  return {
    errorType: isError ? err.name || "Error" : "Error",
    message: truncate(isError ? err.message : String(err), MESSAGE_MAX),
    stack: isError && err.stack ? truncate(err.stack, STACK_MAX) : null,
    route: ctx?.route ?? null,
    status: null,
  };
}

export function dedupeKey(payload: { errorType: string; message: string; route: string | null }): string {
  return `${payload.errorType}|${payload.message}|${payload.route ?? ""}`;
}
