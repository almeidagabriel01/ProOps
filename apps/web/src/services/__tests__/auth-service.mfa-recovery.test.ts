import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";

// auth-service depends on callPublicApi for the recovery endpoints — mock it to
// assert URL/method/payload and that errors propagate (no swallowing catch).
vi.mock("@/lib/api-client", () => ({
  callApi: vi.fn(),
  callPublicApi: vi.fn(),
}));

import { callPublicApi } from "@/lib/api-client";
import { AuthService } from "../auth-service";

const mockedCallPublicApi = callPublicApi as unknown as Mock;

describe("AuthService.requestMfaRecovery", () => {
  beforeEach(() => mockedCallPublicApi.mockReset());

  it("POSTs the email to /v1/auth/forgot-mfa", async () => {
    mockedCallPublicApi.mockResolvedValueOnce({ success: true });

    const result = await AuthService.requestMfaRecovery("user@example.com");

    expect(mockedCallPublicApi).toHaveBeenCalledWith(
      "v1/auth/forgot-mfa",
      "POST",
      { email: "user@example.com" },
    );
    expect(result).toEqual({ success: true });
  });
});

describe("AuthService.inspectMfaRecoveryToken", () => {
  beforeEach(() => mockedCallPublicApi.mockReset());

  it("POSTs the token to /v1/auth/mfa-recovery/inspect and returns the shape", async () => {
    mockedCallPublicApi.mockResolvedValueOnce({ valid: true, hasPassword: true });

    const result = await AuthService.inspectMfaRecoveryToken("tok-123");

    expect(mockedCallPublicApi).toHaveBeenCalledWith(
      "v1/auth/mfa-recovery/inspect",
      "POST",
      { token: "tok-123" },
    );
    expect(result).toEqual({ valid: true, hasPassword: true });
  });

  it("supports an invalid token response without hasPassword", async () => {
    mockedCallPublicApi.mockResolvedValueOnce({ valid: false });

    const result = await AuthService.inspectMfaRecoveryToken("bad");

    expect(result).toEqual({ valid: false });
  });
});

describe("AuthService.confirmMfaRecovery", () => {
  beforeEach(() => mockedCallPublicApi.mockReset());

  it("includes the password when provided (password account)", async () => {
    mockedCallPublicApi.mockResolvedValueOnce({ success: true });

    const result = await AuthService.confirmMfaRecovery("tok", "s3cret");

    expect(mockedCallPublicApi).toHaveBeenCalledWith(
      "v1/auth/mfa-recovery/confirm",
      "POST",
      { token: "tok", password: "s3cret" },
    );
    expect(result).toEqual({ success: true });
  });

  it("omits the password key entirely for link-only (Google) accounts", async () => {
    mockedCallPublicApi.mockResolvedValueOnce({ success: true });

    await AuthService.confirmMfaRecovery("tok");

    expect(mockedCallPublicApi).toHaveBeenCalledWith(
      "v1/auth/mfa-recovery/confirm",
      "POST",
      { token: "tok" },
    );
  });

  it("propagates the backend error message (e.g. wrong password) to the caller", async () => {
    mockedCallPublicApi.mockRejectedValueOnce(new Error("Senha incorreta."));

    await expect(
      AuthService.confirmMfaRecovery("tok", "wrong"),
    ).rejects.toThrow("Senha incorreta.");
  });

  it("propagates an invalid/expired token error", async () => {
    mockedCallPublicApi.mockRejectedValueOnce(
      new Error("Token inválido ou expirado."),
    );

    await expect(AuthService.confirmMfaRecovery("tok")).rejects.toThrow(
      "Token inválido ou expirado.",
    );
  });
});
