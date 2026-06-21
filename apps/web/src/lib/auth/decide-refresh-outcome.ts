/**
 * Pure, state-driven decision for the `/auth/refresh` interstitial. Replaces the
 * old fixed 4000ms `setTimeout` recovery on the login page with a deterministic,
 * bounded-attempt flow whose every transition is keyed off observable state
 * (Firebase init, user presence, cookie sync, the WhatsApp gate, attempt count,
 * watchdog) rather than a sleep.
 *
 * Outcomes:
 * - `redirect-next`  — cookie synced; send the user to their intended path.
 * - `redirect-login` — terminal failure; bounce to /login (no user, gate owed,
 *                      attempts exhausted, or the watchdog ceiling hit).
 * - `retry`          — not yet resolved; wait for the next state change.
 *
 * The WhatsApp gate is treated as a terminal `redirect-login`: the login page's
 * existing reflection effect re-shows the OTP screen from the provider's
 * `whatsappMfaPending` state. Re-minting here would never succeed (the cookie is
 * deliberately withheld until the code is verified), so looping is wrong.
 */
export type RefreshOutcome = "redirect-next" | "redirect-login" | "retry";

export interface RefreshDecisionInput {
  /** Firebase auth state has settled at least once (init complete). */
  authReady: boolean;
  /** A Firebase user is present (refresh token still valid). */
  hasUser: boolean;
  /** The __session cookie has been (re)minted and is in sync. */
  isSessionSynced: boolean;
  /** A WhatsApp OTP gate is pending — the cookie is withheld by design. */
  whatsappPending: boolean;
  /** Bounded re-mint attempts already consumed. */
  attemptsUsed: number;
  /** Hard cap on re-mint attempts. */
  maxAttempts: number;
  /** The interstitial's own watchdog deadline has elapsed. */
  watchdogFired: boolean;
}

export function decideRefreshOutcome(input: RefreshDecisionInput): RefreshOutcome {
  // Last-resort ceiling: never spin past the watchdog.
  if (input.watchdogFired) return "redirect-login";
  // Wait for Firebase to restore (or reject) the persisted session.
  if (!input.authReady) return "retry";
  // No user → the refresh token is gone; only a fresh login can recover.
  if (!input.hasUser) return "redirect-login";
  // 2FA owed → terminal; the login page re-shows the OTP screen.
  if (input.whatsappPending) return "redirect-login";
  // Cookie minted → enter the app.
  if (input.isSessionSynced) return "redirect-next";
  // Bounded attempts exhausted without a cookie → terminal failure.
  if (input.attemptsUsed >= input.maxAttempts) return "redirect-login";
  // Still have budget — keep trying.
  return "retry";
}
