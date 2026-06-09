import { callApi } from "@/lib/api-client";

export interface GenerateRecoveryCodesResponse {
  /** 10 plaintext recovery codes, shown to the user exactly once. */
  codes: string[];
}

export interface RecoveryCodesStatusResponse {
  /** Total codes generated in the current batch. */
  total: number;
  /** How many of those codes are still unused. */
  remaining: number;
  /** ISO timestamp of when the current batch was generated, if any. */
  generatedAt?: string;
}

/**
 * Authenticated client for the MFA recovery-codes endpoints. These require a
 * valid Firebase ID token, so they go through `callApi` (NOT `callPublicApi`).
 * Errors surface as `ApiError` and are propagated to the UI. The plaintext
 * codes returned by `generate` are shown only once — never log or persist them.
 */
export const RecoveryCodesService = {
  /**
   * Generates a fresh batch of recovery codes, invalidating any previous batch.
   * Returns the 10 plaintext codes to display once. Throws on backend errors.
   */
  async generateRecoveryCodes(): Promise<GenerateRecoveryCodesResponse> {
    return callApi<GenerateRecoveryCodesResponse>(
      "v1/auth/recovery-codes/generate",
      "POST",
    );
  },

  /**
   * Reads how many recovery codes remain unused for the current user. Used to
   * show the count and to decide whether to auto-offer generation after a first
   * 2FA enroll (`total === 0`). Throws on backend errors.
   */
  async getRecoveryCodesStatus(): Promise<RecoveryCodesStatusResponse> {
    return callApi<RecoveryCodesStatusResponse>(
      "v1/auth/recovery-codes/status",
      "GET",
    );
  },
};
