import { callApi, callPublicApi } from "@/lib/api-client";

export interface RequestPasswordResetResponse {
  success: boolean;
}

export interface RequestEmailVerificationResponse {
  success: boolean;
  alreadyVerified?: boolean;
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
};
