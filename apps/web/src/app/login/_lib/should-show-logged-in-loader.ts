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
 */
export interface LoggedInLoaderState {
  isLoggingIn: boolean;
  isRegistering: boolean;
  sessionRecoveryFailed: boolean;
  requiresMfaCode: boolean;
  requiresWhatsappOtp: boolean;
}

export function shouldShowLoggedInLoader(state: LoggedInLoaderState): boolean {
  if (state.isLoggingIn || state.isRegistering || state.sessionRecoveryFailed) {
    return false;
  }
  if (state.requiresMfaCode || state.requiresWhatsappOtp) {
    return false;
  }
  return true;
}
