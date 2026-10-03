/**
 * "Encerrar acesso agora": o superadmin corta o contrato manual sem esperar a
 * data, levando a empresa ao estado em que o cron a deixaria depois da
 * carência. Empresa cobrada pelo Stripe é recusada.
 */

let tenantDoc: Record<string, unknown> | null = null;
let manualUsers: Array<{ id: string; data: Record<string, unknown> }> = [];
const batchUpdates: Array<{ path: string; data: Record<string, unknown> }> = [];
let isSuperAdmin = true;

jest.mock("../../../init", () => ({
  auth: {},
  db: {
    batch: () => ({
      update: (ref: { path: string }, data: Record<string, unknown>) => batchUpdates.push({ path: ref.path, data }),
      commit: async () => undefined,
    }),
    collection: (name: string) => {
      if (name === "tenants") {
        return {
          doc: (id: string) => ({
            path: `tenants/${id}`,
            get: async () => ({ exists: tenantDoc !== null, data: () => tenantDoc }),
          }),
        };
      }
      const chain = {
        where: () => chain,
        limit: () => chain,
        get: async () => ({
          empty: manualUsers.length === 0,
          size: manualUsers.length,
          docs: manualUsers.map((u) => ({ ref: { path: `users/${u.id}` }, data: () => u.data })),
        }),
      };
      return chain;
    },
  },
}));

jest.mock("../../../stripe/stripeConfig", () => ({ getStripe: jest.fn() }));
const syncTenantPlanBillingSnapshot = jest.fn(async (_p: unknown) => undefined);
jest.mock("../../../stripe/stripeWebhook", () => ({
  syncTenantPlanBillingSnapshot: (p: unknown) => syncTenantPlanBillingSnapshot(p),
}));
const auditAdminAction = jest.fn(async () => undefined);
jest.mock("../../../lib/admin-audit", () => ({
  auditAdminAction: (...a: unknown[]) => auditAdminAction(...(a as [])),
}));
jest.mock("../../../lib/request-auth", () => ({
  isSuperAdminClaim: () => isSuperAdmin,
  isTenantAdminClaim: () => true,
}));
const clearTenantPlanCache = jest.fn();
jest.mock("../../../lib/tenant-plan-policy", () => ({
  clearTenantPlanCache: (...a: unknown[]) => clearTenantPlanCache(...a),
  enforceTenantPlanLimit: jest.fn(),
  getTenantPlanProfile: jest.fn(),
  getTenantUsersUsage: jest.fn(),
  normalizePlanTier: jest.fn(),
}));
jest.mock("../../../billing", () => ({ enqueueTenantSync: jest.fn(), isStale: jest.fn() }));
jest.mock("../../../billing/price-drift", () => ({ detectPriceDrift: jest.fn() }));
jest.mock("firebase-admin/storage", () => ({ getStorage: jest.fn() }));
jest.mock("../../../lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { endManualAccess } from "../admin.controller";

function makeRes() {
  const res: Record<string, unknown> = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res as { status: jest.Mock; json: jest.Mock };
}

async function call(tenantId = "t1") {
  const res = makeRes();
  await endManualAccess(
    { params: { tenantId }, body: {}, user: { uid: "sa", isSuperAdmin: true } } as never,
    res as never,
  );
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  batchUpdates.length = 0;
  isSuperAdmin = true;
  tenantDoc = { name: "Maison", plan: "enterprise", isManualSubscription: true, subscriptionStatus: "active" };
  manualUsers = [{ id: "u1", data: { tenantId: "t1", isManualSubscription: true, planId: "enterprise" } }];
});

it("encerra o contrato manual: canceled + free no usuário e no tenant (pelo writer único)", async () => {
  const res = await call();

  expect(res.status).not.toHaveBeenCalled();
  expect(batchUpdates).toEqual([
    {
      path: "users/u1",
      data: expect.objectContaining({ subscriptionStatus: "canceled", planId: "free", pastDueSince: null }),
    },
  ]);
  expect(syncTenantPlanBillingSnapshot).toHaveBeenCalledWith({
    tenantId: "t1",
    subscriptionStatus: "canceled",
    plan: "free",
    source: "admin.endManualAccess",
  });
  expect(auditAdminAction).toHaveBeenCalledWith(
    expect.anything(),
    "super_admin_manual_access_ended",
    expect.objectContaining({ tenantId: "t1" }),
  );
});

it("vale também durante a carência", async () => {
  tenantDoc = { ...tenantDoc, subscriptionStatus: "past_due", pastDueSince: "2027-09-15T03:00:00.000Z" };
  const res = await call();
  expect(res.status).not.toHaveBeenCalled();
  expect(syncTenantPlanBillingSnapshot).toHaveBeenCalledWith(
    expect.objectContaining({ subscriptionStatus: "canceled", plan: "free" }),
  );
});

it("empresa cobrada pelo Stripe é recusada com 409 e nada é gravado", async () => {
  tenantDoc = { name: "Cartao", plan: "pro", stripeSubscriptionId: "sub_1", subscriptionStatus: "active" };
  manualUsers = [];
  const res = await call();
  expect(res.status).toHaveBeenCalledWith(409);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "STRIPE_MANAGED_SUBSCRIPTION" }));
  expect(batchUpdates).toEqual([]);
  expect(syncTenantPlanBillingSnapshot).not.toHaveBeenCalled();
});

it("empresa sem plano manual é recusada com 409", async () => {
  tenantDoc = { name: "Free", plan: "free" };
  manualUsers = [];
  const res = await call();
  expect(res.status).toHaveBeenCalledWith(409);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "NOT_MANUAL_SUBSCRIPTION" }));
  expect(batchUpdates).toEqual([]);
});

it("quem não é superadmin leva 403", async () => {
  isSuperAdmin = false;
  const res = await call();
  expect(res.status).toHaveBeenCalledWith(403);
  expect(batchUpdates).toEqual([]);
});

it("empresa inexistente dá 404", async () => {
  tenantDoc = null;
  const res = await call();
  expect(res.status).toHaveBeenCalledWith(404);
});
