"use client";

import { useCallback, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  getCookieConsentDismissed,
  setCookieConsentDismissed,
} from "@/lib/cookie-consent-storage";

const CONSENT_CHANGED_EVENT = "proops:cookie-consent-changed";

function subscribe(callback: () => void) {
  window.addEventListener(CONSENT_CHANGED_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CONSENT_CHANGED_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function CookieConsentBanner() {
  // Server/hydration snapshot returns `true` (treated as dismissed) so nothing
  // renders during SSR; the banner appears only after the client reads
  // localStorage, avoiding a hydration mismatch.
  const dismissed = useSyncExternalStore(
    subscribe,
    getCookieConsentDismissed,
    () => true,
  );

  const handleDismiss = useCallback(() => {
    setCookieConsentDismissed();
    window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT));
  }, []);

  if (dismissed) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] px-4 pb-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-black/10 bg-white/95 p-4 shadow-lg backdrop-blur dark:border-white/10 dark:bg-neutral-950/95 sm:flex-row sm:items-center sm:gap-4">
        <p className="text-sm leading-6 text-black/75 dark:text-white/75">
          <span aria-hidden="true">🍪</span> Usamos cookies para melhorar sua
          experiência e analisar o uso da plataforma. Saiba mais na{" "}
          <Link
            href="/cookies"
            className="font-medium text-primary hover:underline"
          >
            Política de Cookies
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:self-auto"
        >
          Entendi
        </button>
      </div>
    </div>
  );
}
