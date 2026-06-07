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

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: Record<string, unknown>,
  ) => string;
  execute: (idOrEl: string | HTMLElement, opts?: Record<string, unknown>) => void;
  reset: (idOrEl: string | HTMLElement) => void;
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

async function ensureWidget(): Promise<string> {
  const turnstile = await waitForTurnstile();
  if (widgetId) return widgetId;

  const container = document.createElement("div");
  // Keep it in the layout (not display:none) so a challenge can render if one
  // is ever required; interaction-only keeps it invisible the rest of the time.
  container.style.position = "fixed";
  container.style.right = "12px";
  container.style.bottom = "12px";
  container.style.zIndex = "2147483647";
  document.body.appendChild(container);

  widgetId = turnstile.render(container, {
    sitekey: SITE_KEY,
    size: "invisible",
    execution: "execute",
    appearance: "interaction-only",
    callback: (token: string) => {
      pendingResolve?.(token);
      pendingResolve = null;
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
