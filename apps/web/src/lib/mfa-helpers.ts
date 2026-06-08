/**
 * Pure, side-effect-free helpers for the TOTP (MFA) enrollment flow.
 * Kept separate from the React hook so they can be unit-tested in isolation.
 */

/** A TOTP code is exactly 6 digits (whitespace trimmed). */
export function isValidTotpCode(code: string): boolean {
  return /^\d{6}$/.test(code.trim());
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
