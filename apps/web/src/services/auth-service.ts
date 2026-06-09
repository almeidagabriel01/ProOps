import { callApi, callPublicApi } from "@/lib/api-client";

export interface RequestPasswordResetResponse {
  success: boolean;
}

export interface RequestEmailVerificationResponse {
  success: boolean;
  alreadyVerified?: boolean;
}

export interface RecoverTotpWithCodeResponse {
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
   * Public endpoint. Removes ONLY the native TOTP second factor for the account
   * matching `email`, consuming one recovery code. WhatsApp 2FA (if any) is kept.
   * Password accounts must pass `password` for reauthentication; Google-only
   * accounts omit it. On a 400 the backend message ("Senha incorreta." or a
   * generic failure) is propagated via `ApiError.message` for the UI to display.
   */
  async recoverTotpWithCode(
    email: string,
    code: string,
    password?: string,
  ): Promise<RecoverTotpWithCodeResponse> {
    return callPublicApi<RecoverTotpWithCodeResponse>(
      "v1/auth/mfa-recovery/recover-totp",
      "POST",
      password !== undefined ? { email, code, password } : { email, code },
    );
  },
};
