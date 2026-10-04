import { describe, expect, it } from "vitest";
import { isManualContractWithoutStripe } from "../manual-contract";

describe("isManualContractWithoutStripe", () => {
  it("contrato manual sem assinatura: todo card assina", () => {
    expect(isManualContractWithoutStripe({ isManualSubscription: true }, {})).toBe(true);
  });

  it("contrato manual que já ganhou assinatura no Stripe deixa de contar", () => {
    expect(
      isManualContractWithoutStripe({ isManualSubscription: true }, { stripeSubscriptionId: "sub_1" }),
    ).toBe(false);
  });

  it("assinatura Stripe comum não é contrato manual", () => {
    expect(isManualContractWithoutStripe({ isManualSubscription: false }, { stripeSubscriptionId: "sub_1" })).toBe(
      false,
    );
  });

  it("o tenant vence o usuário; sem tenant, o usuário é a reserva", () => {
    expect(isManualContractWithoutStripe({ isManualSubscription: false }, { isManualSubscription: true })).toBe(false);
    expect(isManualContractWithoutStripe(null, { isManualSubscription: true })).toBe(true);
    expect(isManualContractWithoutStripe(null, null)).toBe(false);
  });
});
