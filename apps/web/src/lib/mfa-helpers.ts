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

/**
 * Masks a phone number for display, keeping only the last 4 digits — e.g.
 * "+5511999991234" → "•••• 1234". Pure and side-effect-free. The backend also
 * returns a `maskedPhone`; prefer that when available and fall back to this for
 * a phone the user just typed (before the backend has echoed it back).
 */
export function maskPhone(phone: string): string {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length <= 4) return digits;
  return `•••• ${digits.slice(-4)}`;
}

/**
 * Whether the profile two-factor selector should offer WhatsApp as a method.
 * Super admins are TOTP-only (the backend rejects WhatsApp enroll for them), so
 * the WhatsApp option is hidden for them entirely. Any other role may choose it.
 */
export function canUseWhatsappMfa(role: string | null | undefined): boolean {
  return String(role || "").trim().toLowerCase() !== "superadmin";
}

/** Inputs for deciding whether to auto-offer recovery codes after a 2FA enroll. */
export interface RecoveryCodesAutoOpenInput {
  /** True once the user has at least one 2FA factor active (TOTP or WhatsApp). */
  hasAnyFactor: boolean;
  /**
   * Total recovery codes the user currently has (0 = none generated yet), or
   * `null` when the status could not be read (e.g. the status request failed).
   * An unknown status must never trigger auto-generation — it is fail-safe.
   */
  recoveryTotal: number | null;
}

/**
 * Whether the recovery-codes modal should auto-open after a 2FA enroll. We only
 * auto-generate when the user just gained their first factor AND we positively
 * know they have no codes yet, so they never end up with 2FA but no recovery
 * safety net. Returns false once any codes exist (preventing re-opening on later
 * enrolls) and also when `recoveryTotal` is `null` — an unknown status (failed
 * read) must not trigger a spurious generation.
 */
export function shouldAutoOpenRecoveryCodes({
  hasAnyFactor,
  recoveryTotal,
}: RecoveryCodesAutoOpenInput): boolean {
  if (recoveryTotal === null) return false;
  return hasAnyFactor && recoveryTotal === 0;
}
