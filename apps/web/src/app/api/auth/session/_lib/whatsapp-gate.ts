/**
 * Pure decision logic for the WhatsApp OTP login gate enforced in the
 * `/api/auth/session` route. Keeping the branching here (instead of inline in
 * the route handler) makes the gate independently testable and the route thin.
 *
 * The actual challenge call (network) and cookie emission stay in the route;
 * this only decides WHAT the route should do based on already-resolved facts.
 */

/** Shape of the backend challenge response we care about for the decision. */
export interface WhatsappChallengeResult {
  mfaRequired?: boolean;
  method?: string;
  maskedPhone?: string;
  /** True when a fresh OTP was sent now; false when a valid one was reused (cooldown). */
  otpSent?: boolean;
  /** Seconds until the user may request a new code (backend-owned cooldown). */
  retryAfterSeconds?: number;
}

export interface WhatsappGateInput {
  /** Super admins use TOTP only — the WhatsApp gate never applies to them. */
  isSuperAdmin: boolean;
  /**
   * Whether the decoded ID token already carries a native second factor
   * (`firebase.sign_in_second_factor`, e.g. TOTP already satisfied).
   */
  hasNativeSecondFactor: boolean;
  /**
   * Whether this sign-in was completed with a one-time recovery code (the
   * `recovery_login` developer claim minted onto the custom token by
   * `recover-totp`). A recovery code is a full 2FA bypass — it must NOT trigger
   * a second WhatsApp challenge, otherwise a user who lost their authenticator
   * AND can't receive WhatsApp would be locked out despite a valid code.
   */
  recoveryLogin: boolean;
  /**
   * Whether the request already carries a valid `__session` cookie for the SAME
   * user (a background re-sync of an existing authenticated session). The OTP
   * gate is a LOGIN step — it must NOT re-challenge an already-authenticated
   * session, otherwise token refresh / visibilitychange re-syncs would send
   * unsolicited OTPs and burn the per-user rate limit.
   */
  alreadyAuthenticated: boolean;
  /**
   * The challenge response from the backend, or `null` when the gate decision
   * is made BEFORE the challenge call (super admin / native 2FA short-circuit).
   */
  challenge: WhatsappChallengeResult | null;
}

/**
 * - `skip`    — do not call the challenge / do not gate; emit the cookie normally.
 * - `require` — the backend says WhatsApp OTP is required; withhold the cookie.
 * - `proceed` — WhatsApp OTP not required; emit the cookie normally.
 */
export type WhatsappGateDecision = "skip" | "require" | "proceed";

export function decideWhatsappGate(input: WhatsappGateInput): WhatsappGateDecision {
  if (input.isSuperAdmin) {
    return "skip";
  }
  if (input.hasNativeSecondFactor) {
    return "skip";
  }
  if (input.recoveryLogin) {
    return "skip";
  }
  if (input.alreadyAuthenticated) {
    return "skip";
  }
  if (input.challenge?.mfaRequired === true) {
    return "require";
  }
  return "proceed";
}
