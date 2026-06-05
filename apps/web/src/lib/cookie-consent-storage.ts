export const COOKIE_CONSENT_KEY = "proops_cookie_consent";

const DISMISSED_VALUE = "dismissed";

export function getCookieConsentDismissed(): boolean {
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem(COOKIE_CONSENT_KEY) === DISMISSED_VALUE;
  } catch {
    return false;
  }
}

export function setCookieConsentDismissed(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, DISMISSED_VALUE);
  } catch {
    // ignore localStorage errors
  }
}
