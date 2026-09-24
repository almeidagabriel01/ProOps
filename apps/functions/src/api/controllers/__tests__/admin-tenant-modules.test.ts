let addonDoc: Record<string, unknown> | null = null;
const sets: Array<{ id: string; data: Record<string, unknown> }> = [];
const deletes: string[] = [];

jest.mock("../../../init", () => ({
  db: {
    collection: () => ({
      doc: (id: string) => ({
        get: async () => ({
          exists: addonDoc !== null,
          get: (f: string) => addonDoc?.[f],
        }),
        set: async (data: Record<string, unknown>) => {
          sets.push({ id, data });
        },
        delete: async () => {
          deletes.push(id);
        },
      }),
    }),
  },
}));

const assertTenantExists = jest.fn(async (_id: string) => undefined);
jest.mock("../../../lib/tenant-resolution", () => ({
  assertTenantExists: (id: string) => assertTenantExists(id),
}));
const clearTenantPlanCache = jest.fn();
jest.mock("../../../lib/tenant-plan-policy", () => ({
  clearTenantPlanCache: (id: string) => clearTenantPlanCache(id),
}));
let profile: { tier: string; activeAddons: string[] } = { tier: "starter", activeAddons: [] };
jest.mock("../../../lib/tenant-capabilities", () => ({
  resolveTenantCapabilities: jest.fn(async () => profile),
}));
const auditAdminAction = jest.fn(async () => undefined);
jest.mock("../../../lib/admin-audit", () => ({
  auditAdminAction: (...a: unknown[]) => auditAdminAction(...(a as [])),
}));
jest.mock("../../../lib/request-auth", () => ({ isSuperAdminClaim: () => true }));
jest.mock("../../../lib/logger", () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } }));

import { grantCourtesyAddon, revokeCourtesyAddon } from "../admin-tenant-modules.controller";

function makeRes() {
  const res: Record<string, unknown> = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res as { status: jest.Mock; json: jest.Mock };
}

async function call(handler: typeof grantCourtesyAddon, addonId: string) {
  const res = makeRes();
  await handler({ params: { tenantId: "t1", addonId }, user: { uid: "sa" } } as never, res as never);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  addonDoc = null;
  profile = { tier: "starter", activeAddons: [] };
  sets.length = 0;
  deletes.length = 0;
});

describe("grantCourtesyAddon", () => {
  it("cria o add-on no mesmo doc da compra, marcado como cortesia e sem assinatura", async () => {
    const res = await call(grantCourtesyAddon, "crm");
    expect(res.status).not.toHaveBeenCalled();
    expect(sets[0].id).toBe("t1_crm");
    expect(sets[0].data).toMatchObject({ tenantId: "t1", addonType: "crm", status: "active", source: "courtesy" });
    expect(sets[0].data).not.toHaveProperty("stripeSubscriptionId");
    expect(clearTenantPlanCache).toHaveBeenCalledWith("t1");
    expect(auditAdminAction).toHaveBeenCalledWith(expect.anything(), "super_admin_addon_granted", { tenantId: "t1", reason: "crm" });
  });

  it("nao sobrescreve um add-on que a empresa paga", async () => {
    addonDoc = { stripeSubscriptionId: "sub_1", status: "active" };
    const res = await call(grantCourtesyAddon, "financial");
    expect(res.status).toHaveBeenCalledWith(409);
    expect(sets).toHaveLength(0);
  });

  it("recusa add-on que o plano da empresa nao compra", async () => {
    profile = { tier: "enterprise", activeAddons: [] };
    const res = await call(grantCourtesyAddon, "fiscal");
    expect(res.status).toHaveBeenCalledWith(400);
    expect(sets).toHaveLength(0);
  });

  it("pagamento online no Starter exige o financeiro antes", async () => {
    const res = await call(grantCourtesyAddon, "online_payments");
    expect(res.status).toHaveBeenCalledWith(400);
    expect(sets).toHaveLength(0);

    profile = { tier: "starter", activeAddons: ["financial"] };
    const ok = await call(grantCourtesyAddon, "online_payments");
    expect(ok.status).not.toHaveBeenCalled();
    expect(sets[0].id).toBe("t1_online_payments");
  });

  it("pagamento online no Pro nao exige nada (o financeiro vem no plano)", async () => {
    profile = { tier: "pro", activeAddons: [] };
    const res = await call(grantCourtesyAddon, "online_payments");
    expect(res.status).not.toHaveBeenCalled();
  });

  it("add-on desconhecido da 400", async () => {
    const res = await call(grantCourtesyAddon, "whatsapp_ilimitado");
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("empresa inexistente da 404", async () => {
    assertTenantExists.mockRejectedValueOnce(new Error("x"));
    const res = await call(grantCourtesyAddon, "crm");
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("revokeCourtesyAddon", () => {
  it("remove a cortesia", async () => {
    addonDoc = { source: "courtesy", status: "active" };
    const res = await call(revokeCourtesyAddon, "crm");
    expect(res.status).not.toHaveBeenCalled();
    expect(deletes).toEqual(["t1_crm"]);
  });

  it("nao remove add-on pago (a cobranca seguiria correndo)", async () => {
    addonDoc = { stripeSubscriptionId: "sub_1", status: "active" };
    const res = await call(revokeCourtesyAddon, "crm");
    expect(res.status).toHaveBeenCalledWith(409);
    expect(deletes).toHaveLength(0);
  });
});
