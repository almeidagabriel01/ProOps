/**
 * Pure decision for the login form: should the elevated WhatsApp-MFA gate
 * (from the AuthProvider) be reflected into the local OTP-screen state?
 *
 * On a page reload (F5) the local `requiresWhatsappOtp` React state is lost, but
 * the still-signed-in Firebase user makes the background session sync re-detect
 * the gate and set `whatsappMfaPending` on the provider. The form then needs to
 * re-show the OTP screen. It must NOT do so when the foreground login path has
 * already set `requiresWhatsappOtp` (otherwise it would loop / double-handle the
 * countdown), so the reflection only fires when the gate is present AND the
 * local OTP screen is not yet shown.
 */
export interface ReflectWhatsappGateState {
  /** True while the provider holds an unresolved WhatsApp-MFA gate. */
  hasWhatsappMfaPending: boolean;
  /** True once the OTP screen is already shown locally. */
  requiresWhatsappOtp: boolean;
}

export function shouldReflectWhatsappGate(
  state: ReflectWhatsappGateState,
): boolean {
  return state.hasWhatsappMfaPending && !state.requiresWhatsappOtp;
}
