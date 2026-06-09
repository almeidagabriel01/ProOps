/**
 * Decides whether the login page should render the full-screen "still resolving
 * auth" loader shown on first paint (before a `user` is known).
 *
 * Critical rule: this loader must be SUPPRESSED while a 2FA challenge screen is
 * active (native TOTP or the WhatsApp OTP gate). Those screens own their own
 * in-progress UI (the "Verificando..." button). Without this suppression, when
 * the Firebase user briefly appears mid-verification (resolveSignIn completes
 * before `requiresMfaCode` is cleared), this loader turned OFF — exposing the
 * TOTP screen for one frame — then the logged-in loader turned ON, producing a
 * visible "loader → flash of TOTP → loader → app" flicker.
 */
export interface InitialLoaderState {
  isLoading: boolean;
  isLoggingIn: boolean;
  isRegistering: boolean;
  hasUser: boolean;
  requiresMfaCode: boolean;
  requiresWhatsappOtp: boolean;
}

export function shouldShowInitialLoader(state: InitialLoaderState): boolean {
  if (state.requiresMfaCode || state.requiresWhatsappOtp) {
    return false;
  }
  return (
    state.isLoading &&
    !state.isLoggingIn &&
    !state.isRegistering &&
    !state.hasUser
  );
}
