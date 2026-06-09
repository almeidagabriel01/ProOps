/**
 * Pure decision for which second-factor verification path the `/api/auth/session`
 * route must run, based on the inputs present in the request body. Keeping the
 * branching here (instead of inline in the route) makes it independently testable
 * and the route thin.
 *
 * The route accepts two mutually-exclusive verification inputs alongside the
 * idToken:
 * - `otpCode`      — a WhatsApp OTP to verify (`whatsapp-mfa/verify`).
 * - `recoveryCode` — a one-time recovery code to verify
 *                    (`recovery-codes/verify`).
 *
 * Both follow the same fail-closed contract: a failed/errored verify withholds
 * the cookie. `otpCode` takes precedence when (defensively) both are present.
 */
export type SessionVerificationPath = "otp" | "recovery-code" | "challenge";

export interface SessionVerificationInput {
  /** A WhatsApp OTP code provided by the client (already trimmed). */
  otpCode: string;
  /** A recovery code provided by the client (already trimmed). */
  recoveryCode: string;
}

/**
 * - `otp`           — verify the WhatsApp OTP before emitting the cookie.
 * - `recovery-code` — verify the recovery code before emitting the cookie.
 * - `challenge`     — no verification input; run the normal first-step gate.
 */
export function decideSessionVerification(
  input: SessionVerificationInput,
): SessionVerificationPath {
  if (input.otpCode) return "otp";
  if (input.recoveryCode) return "recovery-code";
  return "challenge";
}
