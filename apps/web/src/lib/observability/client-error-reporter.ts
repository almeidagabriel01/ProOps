// apps/web/src/lib/observability/client-error-reporter.ts
import { buildClientErrorPayload, dedupeKey } from "./report-error";

const ENDPOINT = "/api/backend/v1/observability/client-error";
const FLUSH_DEBOUNCE_MS = 2000;
const MAX_BUFFER = 20;

type Payload = ReturnType<typeof buildClientErrorPayload>;

let installed = false;
let reentrant = false;
const buffer = new Map<string, Payload>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function send(payload: Payload): void {
  try {
    const body = JSON.stringify(payload);
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(ENDPOINT, blob);
      return;
    }
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // best-effort
  }
}

function flush(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (buffer.size === 0) return;
  const items = Array.from(buffer.values());
  buffer.clear();
  items.forEach(send);
}

export function reportClientError(err: unknown, ctx?: { route?: string; status?: number }): void {
  if (typeof window === "undefined") return;
  try {
    const route =
      ctx?.route ?? (typeof window !== "undefined" ? window.location.pathname : null) ?? undefined;
    const payload = buildClientErrorPayload(err, { route, status: ctx?.status });
    const key = dedupeKey(payload);
    if (!buffer.has(key)) buffer.set(key, payload);
    if (buffer.size >= MAX_BUFFER) {
      flush();
      return;
    }
    if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_DEBOUNCE_MS);
  } catch {
    // never throw from the reporter
  }
}

/** Report a console.error arg only when it is a real Error (or carries a stack). */
export function shouldReportConsoleArg(arg: unknown): boolean {
  if (arg instanceof Error) return true;
  return (
    typeof arg === "object" &&
    arg !== null &&
    typeof (arg as { stack?: unknown }).stack === "string"
  );
}

export function installClientErrorReporter(): () => void {
  if (installed || typeof window === "undefined") return () => undefined;
  installed = true;

  const onError = (event: ErrorEvent) => reportClientError(event.error ?? event.message);
  const onRejection = (event: PromiseRejectionEvent) => reportClientError(event.reason);
  const onHide = () => flush();

  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") flush();
  };

  const originalConsoleError = console.error;
  const patchedConsoleError = (...args: unknown[]): void => {
    originalConsoleError(...(args as []));
    if (reentrant) return;
    if (!shouldReportConsoleArg(args[0])) return;
    reentrant = true;
    try {
      reportClientError(args[0]);
    } finally {
      reentrant = false;
    }
  };
  console.error = patchedConsoleError as typeof console.error;

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  window.addEventListener("pagehide", onHide);
  document.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (console.error === patchedConsoleError) {
      console.error = originalConsoleError;
    }
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    window.removeEventListener("pagehide", onHide);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    installed = false;
  };
}
