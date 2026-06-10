import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";

// WhatsappMfaService depends on the AUTHENTICATED callApi (not callPublicApi) —
// mock it to assert URL/method/payload and that errors propagate to the UI.
vi.mock("@/lib/api-client", () => ({
  callApi: vi.fn(),
  callPublicApi: vi.fn(),
}));

import { callApi } from "@/lib/api-client";
import { WhatsappMfaService } from "../whatsapp-mfa-service";

const mockedCallApi = callApi as unknown as Mock;

describe("WhatsappMfaService.startWhatsappEnroll", () => {
  beforeEach(() => mockedCallApi.mockReset());

  it("POSTs the phone to the authenticated enroll/start endpoint", async () => {
    mockedCallApi.mockResolvedValueOnce({
      success: true,
      maskedPhone: "•••• 1234",
    });

    const result = await WhatsappMfaService.startWhatsappEnroll("+5511999991234");

    expect(mockedCallApi).toHaveBeenCalledWith(
      "v1/auth/whatsapp-mfa/enroll/start",
      "POST",
      { phone: "+5511999991234" },
    );
    expect(result).toEqual({ success: true, maskedPhone: "•••• 1234" });
  });

  it("propagates a 409 (number already in use on another account) error to the caller", async () => {
    mockedCallApi.mockRejectedValueOnce(
      new Error("Este número de WhatsApp já está vinculado a outra conta."),
    );

    await expect(
      WhatsappMfaService.startWhatsappEnroll("+5511999991234"),
    ).rejects.toThrow("Este número de WhatsApp já está vinculado a outra conta.");
  });

  it("propagates a 429 (cooldown) error to the caller", async () => {
    mockedCallApi.mockRejectedValueOnce(new Error("Aguarde antes de reenviar."));

    await expect(
      WhatsappMfaService.startWhatsappEnroll("+5511999991234"),
    ).rejects.toThrow("Aguarde antes de reenviar.");
  });
});

describe("WhatsappMfaService.verifyWhatsappEnroll", () => {
  beforeEach(() => mockedCallApi.mockReset());

  it("POSTs the code to the authenticated enroll/verify endpoint", async () => {
    mockedCallApi.mockResolvedValueOnce({ success: true });

    const result = await WhatsappMfaService.verifyWhatsappEnroll("123456");

    expect(mockedCallApi).toHaveBeenCalledWith(
      "v1/auth/whatsapp-mfa/enroll/verify",
      "POST",
      { code: "123456" },
    );
    expect(result).toEqual({ success: true });
  });

  it("propagates the backend error (wrong code) to the caller", async () => {
    mockedCallApi.mockRejectedValueOnce(new Error("Código inválido."));

    await expect(
      WhatsappMfaService.verifyWhatsappEnroll("000000"),
    ).rejects.toThrow("Código inválido.");
  });
});

describe("WhatsappMfaService.disableWhatsappMfa", () => {
  beforeEach(() => mockedCallApi.mockReset());

  it("POSTs to the authenticated disable endpoint with no body", async () => {
    mockedCallApi.mockResolvedValueOnce({ success: true });

    const result = await WhatsappMfaService.disableWhatsappMfa();

    expect(mockedCallApi).toHaveBeenCalledWith(
      "v1/auth/whatsapp-mfa/disable",
      "POST",
    );
    expect(result).toEqual({ success: true });
  });

  it("propagates an error to the caller", async () => {
    mockedCallApi.mockRejectedValueOnce(new Error("Falha ao desativar."));

    await expect(WhatsappMfaService.disableWhatsappMfa()).rejects.toThrow(
      "Falha ao desativar.",
    );
  });
});
