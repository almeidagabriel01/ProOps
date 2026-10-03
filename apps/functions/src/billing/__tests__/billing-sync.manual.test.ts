/**
 * A sincronização diária com o Stripe não pode mexer em contrato manual: um
 * Customer antigo com assinatura cancelada fazia o cron gravar canceled + free
 * por cima do plano dado pelo superadmin.
 */

let tenantDoc: Record<string, unknown> = {};
const tenantSets: Array<Record<string, unknown>> = [];
const subscriptionsList = jest.fn(async () => ({
  data: [
    {
      id: "sub_antiga",
      status: "canceled",
      created: 1,
      cancel_at_period_end: false,
      items: { data: [{ price: { id: "price_starter" } }] },
    },
  ],
}));
const syncTenantPlanBillingSnapshot = jest.fn(async (_p: unknown) => undefined);

jest.mock("../../init", () => ({
  db: {
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: true, data: () => tenantDoc }),
        set: async (data: Record<string, unknown>) => void tenantSets.push(data),
      }),
      where: () => ({ where: () => ({ limit: () => ({ get: async () => ({ empty: true, docs: [] }) }) }) }),
    }),
  },
}));
jest.mock("../../stripe/stripeConfig", () => ({
  getStripe: () => ({ subscriptions: { list: subscriptionsList } }),
  getPriceConfig: () => ({ plans: { starter: { monthly: "price_starter", yearly: "price_starter_y" } } }),
}));
jest.mock("../../stripe/stripeWebhook", () => ({
  syncTenantPlanBillingSnapshot: (p: unknown) => syncTenantPlanBillingSnapshot(p),
}));
jest.mock("../../stripe/stripeHelpers", () => ({
  WHATSAPP_OVERAGE_PRICE_ID: "price_whatsapp",
  updateSubscriptionStatus: jest.fn(),
  upsertTenantStripeBillingData: jest.fn(),
  mapStripeSubscriptionStatus: jest.fn(),
}));
jest.mock("../duplicate-handler", () => ({ findAndCancelDuplicateSubscriptions: jest.fn() }));
jest.mock("../../lib/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { syncTenantBillingFromStripe } from "../billing-sync.service";

beforeEach(() => {
  jest.clearAllMocks();
  tenantSets.length = 0;
});

it("contrato manual com Customer antigo não é tocado pelo cron", async () => {
  tenantDoc = {
    isManualSubscription: true,
    stripeCustomerId: "cus_antigo",
    plan: "enterprise",
    subscriptionStatus: "active",
    currentPeriodEnd: "2027-09-14T00:00:00.000Z",
  };

  const snapshot = await syncTenantBillingFromStripe("t1", { source: "cron" });

  expect(subscriptionsList).not.toHaveBeenCalled();
  expect(syncTenantPlanBillingSnapshot).not.toHaveBeenCalled();
  expect(tenantSets).toEqual([]);
  expect(snapshot).toMatchObject({ plan: "enterprise", subscriptionStatus: "active" });
});

it("contrato manual em carência mantém o pastDueSince", async () => {
  tenantDoc = {
    isManualSubscription: true,
    stripeCustomerId: "cus_antigo",
    plan: "pro",
    subscriptionStatus: "past_due",
    pastDueSince: "2027-09-15T03:00:00.000Z",
  };
  const snapshot = await syncTenantBillingFromStripe("t1", { source: "cron" });
  expect(snapshot).toMatchObject({ subscriptionStatus: "past_due", pastDueSince: "2027-09-15T03:00:00.000Z" });
  expect(syncTenantPlanBillingSnapshot).not.toHaveBeenCalled();
});

it("empresa do Stripe continua sincronizando (a assinatura cancelada é aplicada)", async () => {
  tenantDoc = { stripeCustomerId: "cus_1", plan: "starter", subscriptionStatus: "active" };

  await syncTenantBillingFromStripe("t1", { source: "cron" });

  expect(subscriptionsList).toHaveBeenCalled();
  expect(syncTenantPlanBillingSnapshot).toHaveBeenCalledWith(
    expect.objectContaining({ tenantId: "t1", subscriptionStatus: "canceled" }),
  );
});
