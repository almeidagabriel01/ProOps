import { callApi } from "@/lib/api-client";

export interface StartWhatsappEnrollResponse {
  success: boolean;
  /** Masked phone the OTP was sent to, e.g. "•••• 1234". */
  maskedPhone?: string;
  /** Seconds until another code can be requested (backend-owned cooldown). */
  retryAfterSeconds?: number;
}

export interface VerifyWhatsappEnrollResponse {
  success: boolean;
}

export interface DisableWhatsappMfaResponse {
  success: boolean;
}

/**
 * Authenticated client for the WhatsApp-MFA enrollment endpoints (Phase B).
 * These require a valid Firebase ID token, so they go through `callApi`
 * (NOT `callPublicApi`). Errors — 403 (super admin), 409 (number already
 * enrolled as MFA on another account), 429 (cooldown/cap), 400 (invalid
 * code/phone with optional `attemptsLeft`) — surface as `ApiError` and are
 * propagated to the UI so it can show the backend `message`/`attemptsLeft`.
 */
export const WhatsappMfaService = {
  /**
   * Starts WhatsApp-MFA enrollment by sending an OTP to `phone`. The backend
   * returns the masked phone for display. Throws on 403/409/429/400.
   */
  async startWhatsappEnroll(
    phone: string,
  ): Promise<StartWhatsappEnrollResponse> {
    return callApi<StartWhatsappEnrollResponse>(
      "v1/auth/whatsapp-mfa/enroll/start",
      "POST",
      { phone },
    );
  },

  /**
   * Confirms WhatsApp-MFA enrollment with the 6-digit `code`. On a wrong code
   * the backend returns 400 with `{ message, attemptsLeft? }` propagated via
   * `ApiError`.
   */
  async verifyWhatsappEnroll(
    code: string,
  ): Promise<VerifyWhatsappEnrollResponse> {
    return callApi<VerifyWhatsappEnrollResponse>(
      "v1/auth/whatsapp-mfa/enroll/verify",
      "POST",
      { code },
    );
  },

  /** Disables WhatsApp-MFA for the current user (clears the enrolled phone). */
  async disableWhatsappMfa(): Promise<DisableWhatsappMfaResponse> {
    return callApi<DisableWhatsappMfaResponse>(
      "v1/auth/whatsapp-mfa/disable",
      "POST",
    );
  },
};
