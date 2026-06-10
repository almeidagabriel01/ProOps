import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";

// recoverTotpWithCode uses the PUBLIC callPublicApi (the user is not logged into
// the backend yet) — mock it to assert URL/method/payload and that errors
// propagate (no swallowing catch).
vi.mock("@/lib/api-client", () => ({
  callApi: vi.fn(),
  callPublicApi: vi.fn(),
}));

import { callPublicApi } from "@/lib/api-client";
import { AuthService } from "../auth-service";

const mockedCallPublicApi = callPublicApi as unknown as Mock;

describe("AuthService.recoverTotpWithCode", () => {
  beforeEach(() => mockedCallPublicApi.mockReset());

  it("POSTs email + code (+ password) and propagates the customToken for a password account", async () => {
    mockedCallPublicApi.mockResolvedValueOnce({
      success: true,
      customToken: "custom-token-abc",
    });

    const result = await AuthService.recoverTotpWithCode(
      "user@example.com",
      "ABCD-1234",
      "s3cret",
    );

    expect(mockedCallPublicApi).toHaveBeenCalledWith(
      "v1/auth/mfa-recovery/recover-totp",
      "POST",
      { email: "user@example.com", code: "ABCD-1234", password: "s3cret" },
    );
    expect(result).toEqual({ success: true, customToken: "custom-token-abc" });
  });

  it("omits the password key entirely for Google-only accounts and propagates the customToken", async () => {
    mockedCallPublicApi.mockResolvedValueOnce({
      success: true,
      customToken: "custom-token-google",
    });

    const result = await AuthService.recoverTotpWithCode(
      "user@example.com",
      "ABCD-1234",
    );

    expect(mockedCallPublicApi).toHaveBeenCalledWith(
      "v1/auth/mfa-recovery/recover-totp",
      "POST",
      { email: "user@example.com", code: "ABCD-1234" },
    );
    expect(result).toEqual({
      success: true,
      customToken: "custom-token-google",
    });
  });

  it("propagates the backend error message (e.g. wrong password) to the caller", async () => {
    mockedCallPublicApi.mockRejectedValueOnce(new Error("Senha incorreta."));

    await expect(
      AuthService.recoverTotpWithCode("user@example.com", "ABCD-1234", "wrong"),
    ).rejects.toThrow("Senha incorreta.");
  });

  it("propagates a generic invalid-code error", async () => {
    mockedCallPublicApi.mockRejectedValueOnce(
      new Error("Código inválido ou expirado."),
    );

    await expect(
      AuthService.recoverTotpWithCode("user@example.com", "bad"),
    ).rejects.toThrow("Código inválido ou expirado.");
  });
});
