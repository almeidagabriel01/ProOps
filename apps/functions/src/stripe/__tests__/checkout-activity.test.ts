/**
 * Jornada da empresa no painel do super admin: o checkout concluído vira
 * "Começou o teste grátis" ou "Assinou" conforme o status da assinatura, e o
 * "Abriu o checkout" leva plano, intervalo, teste e o tipo do checkout.
 */
jest.mock("firebase-functions/v2/https", () => ({
  onRequest: (_opts: unknown, handler: unknown) => handler,
}));
jest.mock("../../init", () => ({ db: {}, auth: {} }));
jest.mock("../../lib/secret-rotation-guard", () => ({ runSecretRotationGuard: jest.fn() }));
jest.mock("../stripeConfig", () => ({ getStripe: jest.fn(), getWebhookSecret: () => "whsec_test" }));

import { resolveCheckoutActivityType } from "../stripeWebhook";
import { buildCheckoutStartedMeta } from "../../api/controllers/stripe.controller";
import { sanitizeActivityMeta } from "../../lib/tenant-activity";

describe("resolveCheckoutActivityType", () => {
  it("assinatura em teste vira trial_started", () => {
    expect(resolveCheckoutActivityType("trialing")).toBe("trial_started");
  });

  it.each(["active", "incomplete", "past_due", null, undefined])("status %s vira subscribed", (status) => {
    expect(resolveCheckoutActivityType(status)).toBe("subscribed");
  });
});

describe("buildCheckoutStartedMeta", () => {
  it("sai no formato que o catálogo aceita, sem perder campo", () => {
    const meta = buildCheckoutStartedMeta({ planTier: "pro", billingInterval: "yearly", trial: true, kind: "new" });
    expect(sanitizeActivityMeta("checkout_started", meta)).toEqual({
      plan: "pro",
      interval: "yearly",
      trial: true,
      kind: "new",
    });
  });

  it("troca de plano com proração", () => {
    const meta = buildCheckoutStartedMeta({ planTier: "enterprise", billingInterval: "monthly", trial: false, kind: "plan_change" });
    expect(sanitizeActivityMeta("checkout_started", meta)).toEqual({
      plan: "enterprise",
      interval: "monthly",
      trial: false,
      kind: "plan_change",
    });
  });
});
