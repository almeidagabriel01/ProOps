/**
 * Pure decision for the AuthProvider's session sync: should the POST to
 * `/api/auth/session` be SKIPPED entirely?
 *
 * Distinct from `shouldShortCircuitSync` (which decides whether a skipped sync
 * may still be MARKED as synced). This one exists so `/auth/refresh` can force
 * a real re-mint even inside the 30s success cooldown — the interstitial is
 * only ever reached because the server rejected or lost the cookie, so stale
 * client-side "recently synced" state must not suppress the POST.
 *
 * The one exception force can NOT override: a pending WhatsApp OTP gate.
 * Skipping the POST during the cooldown is the only guard against issuing a
 * duplicate OTP challenge, so a pending gate always skips.
 */
export interface SkipSyncPostState {
  /** True while a recent successful sync primed the cooldown window. */
  cooldownActive: boolean;
  /** Caller explicitly demands a real re-mint (e.g., /auth/refresh). */
  forceRequested: boolean;
  /** True while a WhatsApp OTP challenge is pending (cookie withheld). */
  whatsappGatePending: boolean;
}

export function shouldSkipSyncPost(state: SkipSyncPostState): boolean {
  return (
    state.cooldownActive && (state.whatsappGatePending || !state.forceRequested)
  );
}
