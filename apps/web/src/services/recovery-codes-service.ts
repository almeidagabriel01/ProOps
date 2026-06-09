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

export interface ReconcileRecoveryCodesResponse {
  /** Whether the user still has any 2FA factor (TOTP native or WhatsApp). */
  hasAnyFactor: boolean;
  /** How many recovery codes remain after reconciliation (0 when none). */
  remaining: number;
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

  /**
   * Reconciles recovery codes against the user's current 2FA factors. If the
   * user has no factor left (no native TOTP and no WhatsApp), the backend
   * deletes the recovery codes so they don't outlive 2FA. Idempotent — safe to
   * call after disabling any method. Throws on backend errors.
   */
  async reconcileRecoveryCodes(): Promise<ReconcileRecoveryCodesResponse> {
    return callApi<ReconcileRecoveryCodesResponse>(
      "v1/auth/recovery-codes/reconcile",
      "POST",
    );
  },
};
