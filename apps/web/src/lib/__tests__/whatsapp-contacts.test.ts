import { describe, it, expect } from "vitest";
import {
  SUPPORT_WHATSAPP_DIGITS,
  BOT_WHATSAPP_DIGITS,
  SUPPORT_WHATSAPP_NUMBER,
  BOT_WHATSAPP_NUMBER,
  buildWhatsAppHref,
} from "../whatsapp-contacts";
import { WHATSAPP_HREF } from "@/components/landing/_shared/whatsapp";

describe("whatsapp-contacts", () => {
  it("usa os dígitos corretos para suporte e bot", () => {
    expect(SUPPORT_WHATSAPP_DIGITS).toBe("5551993489758");
    expect(BOT_WHATSAPP_DIGITS).toBe("5535984219483");
  });

  it("mantém os números humanos separados", () => {
    expect(SUPPORT_WHATSAPP_NUMBER).toBe("+55 51 99348-9758");
    expect(BOT_WHATSAPP_NUMBER).toBe("+55 35 98421-9483");
  });

  // Regressão: suporte e bot NÃO podem compartilhar o mesmo número (causa do bug).
  it("desacopla suporte do bot", () => {
    expect(SUPPORT_WHATSAPP_DIGITS).not.toBe(BOT_WHATSAPP_DIGITS);
  });

  describe("buildWhatsAppHref", () => {
    it("monta o link wa.me a partir dos dígitos", () => {
      expect(buildWhatsAppHref("5535984219483")).toBe(
        "https://wa.me/5535984219483",
      );
    });

    it("anexa a mensagem codificada quando fornecida", () => {
      const href = buildWhatsAppHref("5551993489758", "Olá ProOps");
      expect(href).toBe("https://wa.me/5551993489758?text=Ol%C3%A1%20ProOps");
    });

    it("retorna string vazia para dígitos vazios", () => {
      expect(buildWhatsAppHref("")).toBe("");
    });
  });

  // A landing deve apontar para o SUPORTE, nunca para o bot.
  it("landing usa o número de suporte, não o do bot", () => {
    expect(WHATSAPP_HREF).toContain(SUPPORT_WHATSAPP_DIGITS);
    expect(WHATSAPP_HREF).not.toContain(BOT_WHATSAPP_DIGITS);
  });
});
