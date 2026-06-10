/**
 * Pure decision for the AuthProvider's background session sync: is it safe to
 * SKIP the `/api/auth/session` POST and short-circuit on the recent-success
 * cooldown?
 *
 * Both `onAuthStateChanged` and `onIdTokenChanged` fire on startup; a 30s
 * cooldown lets the second listener skip the redundant POST and immediately
 * treat the session as synced. That shortcut is ONLY safe when there is no
 * pending WhatsApp gate. If a WhatsApp OTP challenge is pending, the shortcut
 * would mark the session synced and clear the gate WITHOUT server verification —
 * a racing listener could then flip `isSessionSynced` to true and let the redirect
 * effect enter the app, bypassing 2FA entirely. When a gate is pending we must
 * NOT short-circuit (verify against the server instead).
 */
export interface ShortCircuitSyncState {
  /** True while a recent successful sync primed the cooldown window. */
  cooldownActive: boolean;
  /** True while a WhatsApp OTP challenge is pending (cookie withheld). */
  whatsappGatePending: boolean;
}

export function shouldShortCircuitSync(state: ShortCircuitSyncState): boolean {
  return state.cooldownActive && !state.whatsappGatePending;
}
