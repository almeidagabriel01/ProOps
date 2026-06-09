import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";

// RecoveryCodesService depends on the AUTHENTICATED callApi — mock it to assert
// URL/method and that errors propagate to the UI.
vi.mock("@/lib/api-client", () => ({
  callApi: vi.fn(),
  callPublicApi: vi.fn(),
}));

import { callApi } from "@/lib/api-client";
import { RecoveryCodesService } from "../recovery-codes-service";

const mockedCallApi = callApi as unknown as Mock;

describe("RecoveryCodesService.generateRecoveryCodes", () => {
  beforeEach(() => mockedCallApi.mockReset());

  it("POSTs to the authenticated generate endpoint with no body", async () => {
    const codes = Array.from({ length: 10 }, (_, i) => `code-${i}`);
    mockedCallApi.mockResolvedValueOnce({ codes });

    const result = await RecoveryCodesService.generateRecoveryCodes();

    expect(mockedCallApi).toHaveBeenCalledWith(
      "v1/auth/recovery-codes/generate",
      "POST",
    );
    expect(result).toEqual({ codes });
  });

  it("propagates a backend error to the caller", async () => {
    mockedCallApi.mockRejectedValueOnce(new Error("Falha ao gerar."));

    await expect(
      RecoveryCodesService.generateRecoveryCodes(),
    ).rejects.toThrow("Falha ao gerar.");
  });
});

describe("RecoveryCodesService.getRecoveryCodesStatus", () => {
  beforeEach(() => mockedCallApi.mockReset());

  it("GETs the authenticated status endpoint", async () => {
    mockedCallApi.mockResolvedValueOnce({
      total: 10,
      remaining: 8,
      generatedAt: "2026-06-08T00:00:00.000Z",
    });

    const result = await RecoveryCodesService.getRecoveryCodesStatus();

    expect(mockedCallApi).toHaveBeenCalledWith(
      "v1/auth/recovery-codes/status",
      "GET",
    );
    expect(result).toEqual({
      total: 10,
      remaining: 8,
      generatedAt: "2026-06-08T00:00:00.000Z",
    });
  });

  it("propagates a backend error to the caller", async () => {
    mockedCallApi.mockRejectedValueOnce(new Error("Falha ao consultar."));

    await expect(
      RecoveryCodesService.getRecoveryCodesStatus(),
    ).rejects.toThrow("Falha ao consultar.");
  });
});

describe("RecoveryCodesService.reconcileRecoveryCodes", () => {
  beforeEach(() => mockedCallApi.mockReset());

  it("POSTs to the authenticated reconcile endpoint with no body", async () => {
    mockedCallApi.mockResolvedValueOnce({ hasAnyFactor: false, remaining: 0 });

    const result = await RecoveryCodesService.reconcileRecoveryCodes();

    expect(mockedCallApi).toHaveBeenCalledWith(
      "v1/auth/recovery-codes/reconcile",
      "POST",
    );
    expect(result).toEqual({ hasAnyFactor: false, remaining: 0 });
  });

  it("returns the remaining count when a factor still exists", async () => {
    mockedCallApi.mockResolvedValueOnce({ hasAnyFactor: true, remaining: 7 });

    const result = await RecoveryCodesService.reconcileRecoveryCodes();

    expect(result).toEqual({ hasAnyFactor: true, remaining: 7 });
  });

  it("propagates a backend error to the caller", async () => {
    mockedCallApi.mockRejectedValueOnce(new Error("Falha ao reconciliar."));

    await expect(
      RecoveryCodesService.reconcileRecoveryCodes(),
    ).rejects.toThrow("Falha ao reconciliar.");
  });
});
