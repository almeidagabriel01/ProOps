import { callApi, callPublicApi } from "@/lib/api-client";

export interface RequestPasswordResetResponse {
  success: boolean;
}

export interface RequestEmailVerificationResponse {
  success: boolean;
  alreadyVerified?: boolean;
}

export interface RequestMfaRecoveryResponse {
  success: boolean;
}

export interface InspectMfaRecoveryTokenResponse {
  valid: boolean;
  hasPassword?: boolean;
}

export interface ConfirmMfaRecoveryResponse {
  success: boolean;
}

export const AuthService = {
  /**
   * Public endpoint. Always resolves with `{ success: true }` regardless of
   * whether the email exists (no enumeration). The backend sends the actual
   * email via Resend with a clean reset URL (`/reset?code=...`).
   */
  async requestPasswordReset(email: string): Promise<RequestPasswordResetResponse> {
    return callPublicApi<RequestPasswordResetResponse>(
      "v1/auth/forgot-password",
      "POST",
      { email },
    );
  },

  /**
   * Authenticated endpoint. Generates an email verification link via Firebase
   * Admin and sends it via Resend with a clean URL (`/verify?code=...`).
   * Requires a valid Firebase ID token on the current user (even if the email
   * is not yet verified).
   */
  async sendVerificationEmail(): Promise<RequestEmailVerificationResponse> {
    return callApi<RequestEmailVerificationResponse>(
      "v1/auth/send-verification",
      "POST",
    );
  },

  /**
   * Public endpoint. Always resolves with `{ success: true }` regardless of
   * whether the email exists or is eligible (no enumeration). The backend sends
   * an email with a single-use recovery link (`/recover-mfa?token=...`) when the
   * account is eligible.
   */
  async requestMfaRecovery(email: string): Promise<RequestMfaRecoveryResponse> {
    return callPublicApi<RequestMfaRecoveryResponse>(
      "v1/auth/forgot-mfa",
      "POST",
      { email },
    );
  },

  /**
   * Public endpoint. Validates the recovery token from the email link and
   * reports whether it is still valid and whether the account has a password
   * provider (so the recovery page can decide if it must ask for the password).
   * Does not leak account existence because it requires a valid signed token.
   */
  async inspectMfaRecoveryToken(
    token: string,
  ): Promise<InspectMfaRecoveryTokenResponse> {
    return callPublicApi<InspectMfaRecoveryTokenResponse>(
      "v1/auth/mfa-recovery/inspect",
      "POST",
      { token },
    );
  },

  /**
   * Public endpoint. Confirms the MFA recovery and removes the user's two-factor
   * factors. Password accounts must pass `password` for reauthentication;
   * Google-only accounts confirm with the link alone. On a 400 the backend
   * message ("Token inválido ou expirado." / "Senha incorreta.") is propagated
   * via `ApiError.message` for the UI to display.
   */
  async confirmMfaRecovery(
    token: string,
    password?: string,
  ): Promise<ConfirmMfaRecoveryResponse> {
    return callPublicApi<ConfirmMfaRecoveryResponse>(
      "v1/auth/mfa-recovery/confirm",
      "POST",
      password !== undefined ? { token, password } : { token },
    );
  },
};
