/**
 * Pure decision for the AuthProvider's stale-identity sync race.
 *
 * On page load `onAuthStateChanged` fires for a cached user (A) and launches a
 * background `/api/auth/session` sync. If the user then signs in as a DIFFERENT
 * account (B) before that sync resolves, A's already-in-flight POST cannot be
 * cancelled — and when it resolves it would otherwise write `isSessionSynced` /
 * the WhatsApp gate for the WRONG identity, racing B's foreground login and
 * possibly leaving the `__session` cookie pointing at A.
 *
 * Every explicit sign-in increments a monotonic auth epoch. A sync captures the
 * epoch at its start; before any shared-state write it checks the captured epoch
 * is still the live one. A superseded sync is computed but its writes are dropped
 * — neutralizing the race deterministically without cancelling any network call
 * (so no partial server cookie state). The increment-only contract means a stale
 * sync always has `currentEpoch !== capturedEpoch`.
 */
export interface AuthEpochState {
  /** Epoch captured when the sync started. */
  capturedEpoch: number;
  /** Live epoch at the moment of the state write. */
  currentEpoch: number;
}

export function isStaleAuthEpoch(state: AuthEpochState): boolean {
  return state.currentEpoch !== state.capturedEpoch;
}
