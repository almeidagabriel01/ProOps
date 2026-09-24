jest.mock("../../stripe/stripeHelpers", () => ({
  WHATSAPP_OVERAGE_PRICE_ID: "price_overage",
}));
jest.mock("../../lib/tenant-plan-policy", () => ({
  resolvePriceToTier: (id: string) => (id === "price_pro_monthly" ? "pro" : null),
}));

import { classifySubscription } from "../subscription-classifier";

const sub = (priceId: string, metadata: Record<string, string> | null = null) => ({
  metadata,
  items: { data: [{ price: { id: priceId } }] },
});

/**
 * Reajuste de add-on = price NOVO no Stripe e a env passando a apontar para
 * ele. Quem ja assinava continua no price antigo, que nao esta mais em env
 * nenhuma. A assinatura dele tem que continuar sendo lida como add-on, senao o
 * webhook a trataria como plano principal.
 */
describe("classifySubscription", () => {
  it("add-on em price antigo (fora das envs) continua add-on pela metadata", () => {
    expect(
      classifySubscription(sub("price_financeiro_2990", { type: "addon", addonType: "financial" })),
    ).toBe("addon");
  });

  it("add-on em price antigo sem metadata cai no fallback de add-on", () => {
    expect(classifySubscription(sub("price_financeiro_2990"))).toBe("addon");
  });

  it("plano principal segue principal", () => {
    expect(classifySubscription(sub("price_pro_monthly"))).toBe("main");
  });

  it("overage segue overage", () => {
    expect(classifySubscription(sub("price_overage"))).toBe("overage");
  });
});
