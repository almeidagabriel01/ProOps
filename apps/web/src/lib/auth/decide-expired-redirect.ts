/**
 * Pure decision for where the proxy sends a request whose __session cookie was
 * rejected by the billing-status gate.
 *
 * - `session_expired` → try a silent re-mint via the `/auth/refresh` interstitial
 *   (the Firebase refresh token may still be valid → user never sees /login).
 * - `session_revoked` → the refresh token itself was revoked, so a re-mint would
 *   fail; skip the hop and go straight to /login.
 *
 * Anything else falls back to `refresh` (the interstitial is itself terminal:
 * it bounces to /login when it can't recover, so this is always safe).
 */
export type ExpiredRedirectTarget = "refresh" | "login";

export function decideExpiredRedirect(input: {
  reason: string | undefined;
}): ExpiredRedirectTarget {
  return input.reason === "session_revoked" ? "login" : "refresh";
}
