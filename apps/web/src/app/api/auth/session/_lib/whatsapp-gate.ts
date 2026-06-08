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
  if (input.challenge?.mfaRequired === true) {
    return "require";
  }
  return "proceed";
}
