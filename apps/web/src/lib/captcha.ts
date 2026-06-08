"use client";

/**
 * Cloudflare Turnstile token provider.
 *
 * Renders a single invisible ("interaction-only") widget on demand and mints a
 * fresh, single-use token for each call. Executions are serialized so multiple
 * blur-triggered validations never race the same widget.
 *
 * When `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is not set (local dev / CI / E2E),
 * `getCaptchaToken` resolves to "" and the backend skips verification, so the
 * signup form keeps working without keys.
 */

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js";
const TOKEN_TIMEOUT_MS = 8000;
// How long the widget stays visible after a verification before it auto-hides.
const AUTO_HIDE_MS = 3000;

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: Record<string, unknown>,
  ) => string;
  execute: (idOrEl: string | HTMLElement, opts?: Record<string, unknown>) => void;
  reset: (idOrEl: string | HTMLElement) => void;
  remove: (idOrEl: string | HTMLElement) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;
let widgetId: string | null = null;
let hasExecutedOnce = false;
let pendingResolve: ((token: string) => void) | null = null;
let chain: Promise<string> = Promise.resolve("");

// Where the widget renders. `mountEl` is set by the form via mountCaptcha() so
// a challenge shows inline below the password field; when no mount point is
// provided we fall back to a fixed bottom-right container.
let mountEl: HTMLElement | null = null;
let renderedInto: HTMLElement | null = null;
let fallbackContainer: HTMLElement | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function loadScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    if (window.turnstile) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Turnstile script"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

async function waitForTurnstile(): Promise<TurnstileApi> {
  await loadScript();
  // The script sets window.turnstile shortly after onload.
  for (let i = 0; i < 50 && !window.turnstile; i++) {
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!window.turnstile) {
    throw new Error("Turnstile unavailable");
  }
  return window.turnstile;
}

// Lazily-created fallback anchor used only when the form didn't provide a mount
// point. Kept off-screen-friendly in the bottom-right corner.
function getFallbackContainer(): HTMLElement {
  if (fallbackContainer) return fallbackContainer;
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.right = "12px";
  container.style.bottom = "12px";
  container.style.zIndex = "2147483647";
  document.body.appendChild(container);
  fallbackContainer = container;
  return container;
}

function showWidget(): void {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  if (renderedInto) renderedInto.style.removeProperty("display");
}

// Auto-dismiss the widget a few seconds after a verification so it doesn't
// linger on screen until a page refresh.
function scheduleHide(): void {
  const target = renderedInto;
  if (!target) return;
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    target.style.display = "none";
    hideTimer = null;
  }, AUTO_HIDE_MS);
}

async function ensureWidget(): Promise<string> {
  const turnstile = await waitForTurnstile();
  const target = mountEl ?? getFallbackContainer();

  // Reuse the widget only while it's still rendered into the desired, attached
  // container.
  if (widgetId && renderedInto === target && renderedInto.isConnected) {
    return widgetId;
  }

  // Container changed or was unmounted (e.g. toggling login/register): drop the
  // stale widget before rendering into the new container.
  if (widgetId) {
    try {
      turnstile.remove(widgetId);
    } catch {
      // The old node may already be detached — ignore.
    }
    widgetId = null;
    hasExecutedOnce = false;
  }

  widgetId = turnstile.render(target, {
    sitekey: SITE_KEY,
    execution: "execute",
    appearance: "interaction-only",
    callback: (token: string) => {
      pendingResolve?.(token);
      pendingResolve = null;
      // Only auto-hide after a real verification — on error/expiry we keep the
      // widget visible so the user can still solve the challenge.
      scheduleHide();
    },
    "error-callback": () => {
      pendingResolve?.("");
      pendingResolve = null;
    },
    "expired-callback": () => {
      pendingResolve?.("");
      pendingResolve = null;
    },
  });
  renderedInto = target;

  return widgetId;
}

/**
 * Returns a fresh Turnstile token, or "" when Turnstile is not configured or
 * cannot produce one (caller should treat "" as "no token available").
 */
export function getCaptchaToken(): Promise<string> {
  if (typeof window === "undefined" || !SITE_KEY) {
    return Promise.resolve("");
  }

  const run = chain.then(
    () =>
      new Promise<string>((resolve) => {
        let settled = false;
        const finish = (token: string) => {
          if (settled) return;
          settled = true;
          resolve(token);
        };

        ensureWidget()
          .then((id) => {
            pendingResolve = finish;
            showWidget();
            if (hasExecutedOnce) {
              window.turnstile?.reset(id);
            }
            hasExecutedOnce = true;
            window.turnstile?.execute(id);
            setTimeout(() => finish(""), TOKEN_TIMEOUT_MS);
          })
          .catch(() => finish(""));
      }),
  );

  // Keep the chain alive regardless of individual outcomes.
  chain = run.catch(() => "");
  return run;
}

/**
 * Mounts the Turnstile widget into a form-provided container so a challenge,
 * when shown, appears inline (below the password field) instead of floating in
 * the corner. Also eagerly loads the script + renders the widget, so the first
 * on-blur `getCaptchaToken()` doesn't pay the script-load + render cost on the
 * critical path.
 *
 * Pass the container element on mount; pass `null` on unmount. No-op when
 * Turnstile is unconfigured.
 */
export function mountCaptcha(container: HTMLElement | null): void {
  if (typeof window === "undefined" || !SITE_KEY) return;
  mountEl = container;
  if (!container) return;
  void ensureWidget().catch(() => {});
}
