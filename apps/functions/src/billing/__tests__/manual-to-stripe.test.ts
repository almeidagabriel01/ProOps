/**
 * Empresa que estava num contrato manual (teste ou plano dado pelo painel) e
 * passou a pagar pelo cartão deixa de ser manual. Sem isso o cron do plano
 * manual cortaria quem está pagando e a sincronização diária pularia o Stripe.
 */

let tenantData: Record<string, unknown> = {};
let tenantPatch: Record<string, unknown> = {};
let manualUserIds: string[] = [];
const userUpdates: Array<{ path: string; data: Record<string, unknown> }> = [];

jest.mock("../../init", () => {
  const tenantRef = { path: "tenants/t1", update: jest.fn(async () => undefined) };
  return {
    db: {
      collection: (name: string) => {
        if (name === "tenants") return { doc: () => tenantRef };
        const query = {
          where: () => query,
          limit: () => query,
          get: async () => ({
            empty: manualUserIds.length === 0,
            size: manualUserIds.length,
            docs: manualUserIds.map((id) => ({ ref: { path: `users/${id}` } })),
          }),
        };
        return query;
      },
      runTransaction: async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({
          get: async () => ({ exists: true, data: () => tenantData }),
          set: (_ref: unknown, patch: Record<string, unknown>) => {
            tenantPatch = patch;
          },
        }),
      batch: () => ({
        update: (ref: { path: string }, data: Record<string, unknown>) => userUpdates.push({ path: ref.path, data }),
        commit: async () => undefined,
      }),
    },
  };
});
jest.mock("../../lib/tenant-plan-policy", () => ({
  clearTenantPlanCache: jest.fn(),
  resolvePriceToTier: jest.fn().mockReturnValue("pro"),
  normalizePlanTier: jest.fn((x: unknown) => x || null),
  compareTiers: jest.fn(),
}));
jest.mock("../../lib/whatsapp-eligibility", () => ({
  tenantPlanAllowsWhatsApp: jest.fn().mockResolvedValue(true),
}));
jest.mock("../../lib/tenant-storage-usage", () => ({ refreshStorageQuotaFlag: jest.fn() }));

import { syncTenantPlanBillingSnapshot } from "../../stripe/stripeWebhook";

beforeEach(() => {
  tenantPatch = {};
  userUpdates.length = 0;
  tenantData = { isManualSubscription: true, plan: "free", subscriptionStatus: "canceled" };
  manualUserIds = ["dono"];
});

it("assinatura ativa vinculada a um tenant manual tira a marca do tenant e do dono", async () => {
  await syncTenantPlanBillingSnapshot({
    tenantId: "t1",
    subscriptionStatus: "active",
    stripeSubscriptionId: "sub_nova",
    plan: "pro",
    source: "webhook.subscription.updated",
  });

  expect(tenantPatch.isManualSubscription).toBe(false);
  expect(userUpdates).toEqual([{ path: "users/dono", data: { isManualSubscription: false } }]);
});

it("assinatura em trial também converte", async () => {
  await syncTenantPlanBillingSnapshot({
    tenantId: "t1",
    subscriptionStatus: "trialing",
    stripeSubscriptionId: "sub_nova",
    source: "webhook.checkout.completed",
  });
  expect(tenantPatch.isManualSubscription).toBe(false);
});

it("evento de assinatura cancelada não desfaz o contrato manual", async () => {
  await syncTenantPlanBillingSnapshot({
    tenantId: "t1",
    subscriptionStatus: "canceled",
    stripeSubscriptionId: "sub_antiga",
    source: "webhook.subscription.updated",
  });
  expect("isManualSubscription" in tenantPatch).toBe(false);
  expect(userUpdates).toEqual([]);
});

it("escrita sem assinatura (painel, cron) não mexe na marca", async () => {
  await syncTenantPlanBillingSnapshot({
    tenantId: "t1",
    subscriptionStatus: "active",
    plan: "enterprise",
    source: "admin.updateUserPlan",
  });
  expect("isManualSubscription" in tenantPatch).toBe(false);
  expect(userUpdates).toEqual([]);
});

it("tenant que já era do Stripe não ganha escrita extra", async () => {
  tenantData = { plan: "pro", subscriptionStatus: "active", stripeSubscriptionId: "sub_1" };
  await syncTenantPlanBillingSnapshot({
    tenantId: "t1",
    subscriptionStatus: "active",
    stripeSubscriptionId: "sub_1",
    source: "webhook.subscription.updated",
  });
  expect("isManualSubscription" in tenantPatch).toBe(false);
  expect(userUpdates).toEqual([]);
});
