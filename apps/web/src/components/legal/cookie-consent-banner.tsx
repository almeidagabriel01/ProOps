"use client";

import { useCallback, useEffect } from "react";
import Link from "next/link";
import {
  getCookieConsentDismissed,
  setCookieConsentDismissed,
} from "@/lib/cookie-consent-storage";

const CONSENT_CHANGED_EVENT = "proops:cookie-consent-changed";
const CONSENT_ATTR = "data-cookie-consent";

/**
 * Visibility is driven by the `html[data-cookie-consent="pending"]` attribute
 * (see globals.css), which `public/cookie-consent-init.js` sets at first paint
 * BEFORE hydration — so the banner is never the late-painting LCP element. The
 * DOM is always server-rendered (hidden by CSS for consented users); React only
 * owns the dismiss interaction and keeps the attribute in sync across tabs.
 */
export function CookieConsentBanner() {
  const handleDismiss = useCallback(() => {
    setCookieConsentDismissed();
    document.documentElement.removeAttribute(CONSENT_ATTR);
    window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT));
  }, []);

  useEffect(() => {
    const sync = () => {
      if (getCookieConsentDismissed()) {
        document.documentElement.removeAttribute(CONSENT_ATTR);
      } else {
        document.documentElement.setAttribute(CONSENT_ATTR, "pending");
      }
    };
    window.addEventListener("storage", sync);
    window.addEventListener(CONSENT_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(CONSENT_CHANGED_EVENT, sync);
    };
  }, []);

  return (
    <div data-pdf-ui className="cookie-banner fixed inset-x-0 bottom-0 z-[100] px-4 pb-4">
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
          className="shrink-0 cursor-pointer rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:self-auto"
        >
          Entendi
        </button>
      </div>
    </div>
  );
}
