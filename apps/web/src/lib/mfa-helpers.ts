/**
 * Pure, side-effect-free helpers for the TOTP (MFA) enrollment flow.
 * Kept separate from the React hook so they can be unit-tested in isolation.
 */

/** A TOTP code is exactly 6 digits (whitespace trimmed). */
export function isValidTotpCode(code: string): boolean {
  return /^\d{6}$/.test(code.trim());
}

/**
 * True when a Firebase auth error signals that a second factor is required.
 * Thrown by both email/password and OAuth (Google) sign-in when the account has
 * MFA enrolled — every sign-in path must route it into the TOTP code challenge.
 */
export function isMfaRequiredError(error: unknown): boolean {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  return code === "auth/multi-factor-auth-required";
}

/** Minimal shape needed to decide MFA enrollment eligibility. */
export interface MfaEligibleUser {
  emailVerified: boolean;
}

export type MfaEnrollEligibility =
  | { ok: true }
  | { ok: false; reason: "no-user" | "email-unverified" };

/**
 * Firebase rejects `mfaEnrollment:start` when the email is not verified.
 * Gate the enrollment UI before calling the SDK so we can show a clear message.
 */
export function canEnrollMfa(user: MfaEligibleUser | null): MfaEnrollEligibility {
  if (!user) return { ok: false, reason: "no-user" };
  if (!user.emailVerified) return { ok: false, reason: "email-unverified" };
  return { ok: true };
}
