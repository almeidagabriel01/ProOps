/**
 * Decides whether the login page should render the full-screen "already logged
 * in — redirecting" loader. Call it only when a Firebase `user` is present.
 *
 * The critical rule: this loader must NOT show while a second-factor screen is
 * pending. Native TOTP holds the Firebase sign-in (no `user` until resolved), so
 * it never hit this guard — but the CUSTOM WhatsApp OTP gate lets the Firebase
 * sign-in COMPLETE (a `user` IS set) and only withholds the session cookie.
 * Without this exclusion the logged-in loader swallowed the WhatsApp OTP screen
 * behind an infinite loader (most visibly on Google sign-in, where the user is
 * set before the gate is surfaced).
 *
 * It must ALSO wait for `isSessionSynced` before showing. A Firebase `user` is
 * set the instant sign-in completes, but the server still has a round-trip to
 * run that decides whether the user actually enters the app (cookie emitted) or
 * is held at the WhatsApp gate. Showing the full-screen "entering app" loader
 * during that undetermined window is misleading and, on the background/persisted
 * session path, it appears before the WhatsApp OTP screen. Gate the loader on
 * `isSessionSynced` so it only renders once the user is genuinely entering; the
 * button spinner (`isLoggingIn`) covers the foreground wait until then.
 */
export interface LoggedInLoaderState {
  isLoggingIn: boolean;
  isRegistering: boolean;
  sessionRecoveryFailed: boolean;
  requiresMfaCode: boolean;
  requiresWhatsappOtp: boolean;
  isSessionSynced: boolean;
}

export function shouldShowLoggedInLoader(state: LoggedInLoaderState): boolean {
  if (state.isLoggingIn || state.isRegistering || state.sessionRecoveryFailed) {
    return false;
  }
  if (state.requiresMfaCode || state.requiresWhatsappOtp) {
    return false;
  }
  // Only the genuine "entering app" state shows the loader. Until the session
  // cookie is synced the outcome is undetermined (could still be the WhatsApp
  // gate) — don't show the full-screen loader prematurely.
  if (!state.isSessionSynced) {
    return false;
  }
  return true;
}
