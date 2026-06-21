/**
 * Pure decision for the AuthProvider's init watchdog.
 *
 * `isLoading` gates the full-screen auth loader and is cleared inside the async
 * `onAuthStateChanged` handler. If any awaited network call in that handler
 * stalls (cold backend, flaky network on wake, Firestore handshake), the loader
 * could persist forever. The watchdog fires after a hard ceiling and, when auth
 * is STILL loading, forces a terminal state (loader off → login form renders).
 *
 * It must NEVER fabricate a user or touch `isSessionSynced`: a late sync can
 * still legitimately succeed. The watchdog only releases the loading gate.
 */
export interface ForceTerminalAuthStateInput {
  /** True once the watchdog deadline has elapsed. */
  watchdogFired: boolean;
  /** True while `isLoading` is still set (Firebase identity unresolved). */
  stillLoading: boolean;
}

export function shouldForceTerminalAuthState(
  input: ForceTerminalAuthStateInput,
): boolean {
  return input.watchdogFired && input.stillLoading;
}
