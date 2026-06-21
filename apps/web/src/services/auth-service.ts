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
  /**
   * Firebase custom token returned by the backend on success. Used with
   * `signInWithCustomToken` to sign the user in WITHOUT triggering the native
   * MFA challenge (the TOTP factor stays enrolled).
   */
  customToken?: string;
}

export interface DevMfaBypassResponse {
  /**
   * True once the dev account has been prepared: native TOTP unenrolled and the
   * `dev_mfa_bypass` claim set. The client then retries the password sign-in
   * (no custom token — LOCAL DEV ONLY, hard-gated to the dev project + localhost).
   */
  success: boolean;
}

export interface WhatsappLoginFallbackAvailability {
  available: boolean;
  /** Masked enrolled phone (e.g. `••••1234`), present only when available. */
  maskedPhone?: string;
}

export interface WhatsappLoginFallbackSendResponse {
  available: boolean;
  maskedPhone?: string;
  /** True when a fresh OTP was sent now; false when a valid one was reused. */
  otpSent?: boolean;
  /** Seconds until the user may request a new code (backend-owned cooldown). */
  retryAfterSeconds?: number;
}

export interface WhatsappLoginFallbackVerifyResponse {
  success: boolean;
  /**
   * Firebase custom token returned on success. Carries the `whatsapp_login`
   * claim and is used with `signInWithCustomToken` to sign the user in WITHOUT
   * the native TOTP challenge (the TOTP factor stays enrolled).
   */
  customToken?: string;
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
   * Public endpoint. Consumes one recovery code for the account matching
   * `email` and, on success, returns a Firebase `customToken` to sign the user
   * in directly (the native TOTP factor stays enrolled). WhatsApp 2FA (if any)
   * is kept and surfaced on sign-in. Password accounts must pass `password` for
   * reauthentication; Google-only accounts omit it. On a 400 the backend message
   * ("Senha incorreta." or a generic failure) is propagated via
   * `ApiError.message` for the UI to display.
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

  /**
   * LOCAL DEV ONLY. Prepares the softcode superadmin for password-only login on
   * localhost: the backend unenrolls the native TOTP factor and sets the
   * `dev_mfa_bypass` claim. The caller then retries the email/password sign-in.
   * Hard-gated to the dev project (`erp-softcode`) + localhost; rejected with
   * 404/403 everywhere else, so it is inert in production.
   */
  async devMfaBypass(
    email: string,
    password: string,
  ): Promise<DevMfaBypassResponse> {
    return callPublicApi<DevMfaBypassResponse>(
      "v1/auth/dev-mfa-bypass",
      "POST",
      { email, password },
    );
  },

  /**
   * Public endpoint. Reports whether the account can receive its 2FA code via
   * WhatsApp on the native TOTP screen — WITHOUT sending anything. Password
   * accounts must pass `password` (validated server-side) for the check to
   * succeed; Google-only accounts omit it. Drives the visibility of the WhatsApp
   * option on the TOTP screen.
   */
  async checkWhatsappLoginFallback(
    email: string,
    password?: string,
  ): Promise<WhatsappLoginFallbackAvailability> {
    return callPublicApi<WhatsappLoginFallbackAvailability>(
      "v1/auth/mfa-recovery/whatsapp/availability",
      "POST",
      password !== undefined ? { email, password } : { email },
    );
  },

  /**
   * Public endpoint. Sends (or, on a still-valid code, reuses) the WhatsApp
   * login OTP. Pass `resend: true` to force a fresh code subject to the backend
   * cooldown. Same identity gate as `checkWhatsappLoginFallback`.
   */
  async sendWhatsappLoginFallback(
    email: string,
    password?: string,
    resend?: boolean,
  ): Promise<WhatsappLoginFallbackSendResponse> {
    const body: Record<string, unknown> = { email };
    if (password !== undefined) body.password = password;
    if (resend) body.resend = true;
    return callPublicApi<WhatsappLoginFallbackSendResponse>(
      "v1/auth/mfa-recovery/whatsapp/send",
      "POST",
      body,
    );
  },

  /**
   * Public endpoint. Verifies the WhatsApp login OTP and, on success, returns a
   * Firebase `customToken` to sign the user in directly (TOTP factor stays
   * enrolled). On a 400 the backend message / `attemptsLeft` is propagated via
   * `ApiError` for the UI to display.
   */
  async verifyWhatsappLoginFallback(
    email: string,
    code: string,
  ): Promise<WhatsappLoginFallbackVerifyResponse> {
    return callPublicApi<WhatsappLoginFallbackVerifyResponse>(
      "v1/auth/mfa-recovery/whatsapp/verify",
      "POST",
      { email, code },
    );
  },
};
