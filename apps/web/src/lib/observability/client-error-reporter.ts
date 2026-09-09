// apps/web/src/lib/observability/client-error-reporter.ts
import { buildClientErrorPayload, dedupeKey } from "./report-error";
import { getCachedIdToken, installIdentityTokenCache } from "./identity-token-cache";

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
    const idToken = getCachedIdToken();
    const body = JSON.stringify(idToken ? { ...payload, idToken } : payload);
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

function stackFrames(stack: string): string[] {
  return stack
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("at ") || line.includes("@"));
}

/**
 * True when the error was thrown entirely inside code that is not ours: a browser
 * extension injected into the main world, or a third-party analytics collector.
 * Those stacks carry no frame pointing at our own bundle, so they are not
 * actionable and only drown real issues in the observability dashboard.
 *
 * Deliberately conservative: anything we cannot positively attribute to a third
 * party is still reported.
 */
export function isThirdPartyError(err: unknown): boolean {
  if (typeof err === "string") return err.replace(/\.$/, "") === "Script error";
  if (!(err instanceof Error) || !err.stack) return false;
  if (typeof window === "undefined") return false;

  const frames = stackFrames(err.stack);
  if (frames.length === 0) return false;

  const ownHints = [window.location.origin, "/_next/", "webpack-internal:"];
  return !frames.some((frame) => ownHints.some((hint) => frame.includes(hint)));
}

export function installClientErrorReporter(): () => void {
  if (installed || typeof window === "undefined") return () => undefined;
  installed = true;

  const uninstallTokenCache = installIdentityTokenCache();

  const onError = (event: ErrorEvent) => {
    const err = event.error ?? event.message;
    if (isThirdPartyError(err)) return;
    reportClientError(err);
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    if (isThirdPartyError(event.reason)) return;
    reportClientError(event.reason);
  };
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
    uninstallTokenCache();
    installed = false;
  };
}
