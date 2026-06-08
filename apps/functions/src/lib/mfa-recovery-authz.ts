/**
 * Pure eligibility decision for the self-service MFA recovery request endpoint.
 * Extracted from the controller so it can be unit-tested without the Firebase
 * import chain.
 *
 * Rule: only send the recovery link when the account exists AND its email is
 * verified. `hasPasswordProvider` does NOT affect whether we send — it is
 * recorded on the token document so the recovery page can decide later whether
 * to ask for a password (password account) or accept the link alone
 * (Google-only account).
 *
 * The caller always responds `{ success: true }` to the client regardless of
 * the decision (anti-enumeration); this only governs whether an email goes out.
 */

export interface RecoveryEligibilityInput {
  userExists: boolean;
  emailVerified: boolean;
}

export function evaluateRecoveryEligibility(
  input: RecoveryEligibilityInput,
): { send: boolean } {
  return { send: input.userExists && input.emailVerified };
}
