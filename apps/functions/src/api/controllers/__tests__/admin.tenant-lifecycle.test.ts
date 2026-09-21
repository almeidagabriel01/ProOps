/**
 * Desativar / reativar / excluir definitivamente empresa.
 *
 * A exclusao antiga apagava parte dos dados numa request so, nao cancelava a
 * assinatura Stripe (cliente seguia cobrado) e o webhook seguinte recriava o
 * tenant. Agora: desativar (reversivel, para a cobranca e o login) e so depois
 * excluir, digitando o nome, por um job em segundo plano.
 */

let tenantDoc: Record<string, unknown> | null = null;
const tenantUpdates: Array<Record<string, unknown>> = [];
const jobSets: Array<Record<string, unknown>> = [];
const updateUser = jest.fn(async (_uid: string, _data: unknown) => undefined);
const revokeRefreshTokens = jest.fn(async (_uid: string) => undefined);
const stripeCancel = jest.fn(async (_id: string) => ({}));

function querySnap(ids: Array<{ id: string; data?: Record<string, unknown> }>) {
  return {
    docs: ids.map((d) => ({ id: d.id, get: (f: string) => d.data?.[f] })),
  };
}

jest.mock("../../../init", () => ({
  auth: {
    updateUser: (uid: string, data: unknown) => updateUser(uid, data),
    revokeRefreshTokens: (uid: string) => revokeRefreshTokens(uid),
  },
  db: {
    collection: (name: string) => {
      if (name === "tenants") {
        return {
          doc: () => ({
            get: async () => ({
              exists: tenantDoc !== null,
              data: () => tenantDoc,
              get: (f: string) => tenantDoc?.[f],
            }),
            update: async (patch: Record<string, unknown>) => {
              tenantUpdates.push(patch);
            },
          }),
        };
      }
      if (name === "tenant_purge_jobs") {
        return {
          doc: () => ({
            set: async (data: Record<string, unknown>) => {
              jobSets.push(data);
            },
          }),
        };
      }
      const chain = {
        where: () => chain,
        select: () => chain,
        limit: () => chain,
        get: async () =>
          name === "users"
            ? querySnap([{ id: "u1" }, { id: "u2" }])
            : name === "addons"
              ? querySnap([{ id: "a1", data: { stripeSubscriptionId: "sub_addon", status: "active" } }])
              : querySnap([]),
      };
      return chain;
    },
  },
}));

jest.mock("../../../stripe/stripeConfig", () => ({
  getStripe: () => ({ subscriptions: { cancel: (id: string) => stripeCancel(id) } }),
}));
jest.mock("../../../stripe/stripeWebhook", () => ({ syncTenantPlanBillingSnapshot: jest.fn() }));
const auditAdminAction = jest.fn(async () => undefined);
jest.mock("../../../lib/admin-audit", () => ({
  auditAdminAction: (...a: unknown[]) => auditAdminAction(...(a as [])),
}));
jest.mock("../../../lib/request-auth", () => ({
  isSuperAdminClaim: () => true,
  isTenantAdminClaim: () => true,
}));
jest.mock("../../../lib/tenant-plan-policy", () => ({
  clearTenantPlanCache: jest.fn(),
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

import { deactivateTenant, purgeTenant, reactivateTenant } from "../admin.controller";

function makeRes() {
  const res: Record<string, unknown> = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res as { status: jest.Mock; json: jest.Mock };
}

async function call(
  handler: typeof deactivateTenant,
  tenantId: string,
  body: Record<string, unknown> = {},
  user: Record<string, unknown> = { uid: "sa", tenantId: "proprio", isSuperAdmin: true },
) {
  const res = makeRes();
  await handler({ params: { tenantId }, body, user } as never, res as never);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  tenantUpdates.length = 0;
  jobSets.length = 0;
  tenantDoc = { name: "Cortinas Silva", stripeSubscriptionId: "sub_main", accountStatus: "active" };
});

describe("deactivateTenant", () => {
  it("cancela assinatura e add-ons no Stripe, bloqueia o login e marca a empresa", async () => {
    const res = await call(deactivateTenant, "t1");
    expect(res.status).not.toHaveBeenCalled();
    expect(stripeCancel.mock.calls.map((c) => c[0]).sort()).toEqual(["sub_addon", "sub_main"]);
    expect(updateUser).toHaveBeenCalledWith("u1", { disabled: true });
    expect(revokeRefreshTokens).toHaveBeenCalledWith("u2");
    expect(tenantUpdates[0]).toMatchObject({ accountStatus: "deactivated", isManualSubscription: false });
    expect(auditAdminAction).toHaveBeenCalledWith(
      expect.anything(),
      "super_admin_tenant_deactivated",
      expect.objectContaining({ tenantId: "t1" }),
    );
  });

  it("assinatura ja cancelada no Stripe nao impede a desativacao", async () => {
    stripeCancel.mockRejectedValueOnce(Object.assign(new Error("x"), { code: "resource_missing" }) as never);
    const res = await call(deactivateTenant, "t1");
    expect(res.status).not.toHaveBeenCalled();
    expect(tenantUpdates[0]).toMatchObject({ accountStatus: "deactivated" });
  });

  it("recusa a propria empresa do superadmin", async () => {
    const res = await call(deactivateTenant, "proprio");
    expect(res.status).toHaveBeenCalledWith(400);
    expect(stripeCancel).not.toHaveBeenCalled();
  });

  it("recusa a propria empresa mesmo durante o Acessar Painel", async () => {
    const res = await call(deactivateTenant, "proprio", {}, {
      uid: "sa",
      tenantId: "alvo",
      isSuperAdmin: true,
      impersonation: { originalTenantId: "proprio", targetTenantId: "alvo" },
    });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("empresa inexistente da 404", async () => {
    tenantDoc = null;
    const res = await call(deactivateTenant, "t1");
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("reactivateTenant", () => {
  it("libera o login de uma empresa desativada", async () => {
    tenantDoc = { name: "X", accountStatus: "deactivated" };
    const res = await call(reactivateTenant, "t1");
    expect(res.status).not.toHaveBeenCalled();
    expect(updateUser).toHaveBeenCalledWith("u1", { disabled: false });
    expect(revokeRefreshTokens).not.toHaveBeenCalled();
    expect(tenantUpdates[0]).toMatchObject({ accountStatus: "active" });
  });

  it("empresa ativa nao e reativada", async () => {
    const res = await call(reactivateTenant, "t1");
    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe("purgeTenant", () => {
  it("exige a empresa desativada antes", async () => {
    const res = await call(purgeTenant, "t1", { confirmName: "Cortinas Silva" });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(jobSets).toHaveLength(0);
  });

  it("exige o nome digitado igual", async () => {
    tenantDoc = { name: "Cortinas Silva", accountStatus: "deactivated" };
    const res = await call(purgeTenant, "t1", { confirmName: "Cortinas" });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(jobSets).toHaveLength(0);
  });

  it("com tudo certo cria o job e marca a empresa como em exclusao", async () => {
    tenantDoc = { name: "Cortinas Silva", accountStatus: "deactivated" };
    const res = await call(purgeTenant, "t1", { confirmName: "  cortinas silva " });
    expect(res.status).toHaveBeenCalledWith(202);
    expect(tenantUpdates[0]).toMatchObject({ accountStatus: "purging" });
    expect(jobSets[0]).toMatchObject({ tenantId: "t1", status: "pending", stageIndex: 0, requestedBy: "sa" });
  });

  it("recusa a propria empresa", async () => {
    const res = await call(purgeTenant, "proprio", { confirmName: "x" });
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
