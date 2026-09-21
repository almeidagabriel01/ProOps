/**
 * createTenant: empresa criada pelo painel precisa nascer igual a uma empresa
 * do fluxo normal.
 *
 * - Conta free ganhava role "admin"/claim ADMIN, e o gate de conta gratuita
 *   (que olha role free) nunca a pegava: ERP inteiro de graca.
 * - Plano e status iam so para o doc do usuario; o doc do tenant, que e o que o
 *   enforcement le, ficava sem nada.
 */

const setCustomUserClaims = jest.fn(async () => undefined);
const txSets: Array<{ path: string; data: Record<string, unknown> }> = [];

jest.mock("../../../init", () => ({
  auth: {
    getUserByEmail: jest.fn(async () => {
      throw Object.assign(new Error("nf"), { code: "auth/user-not-found" });
    }),
    createUser: jest.fn(async () => ({ uid: "uid-novo" })),
    setCustomUserClaims: (...args: unknown[]) => setCustomUserClaims(...(args as [])),
    deleteUser: jest.fn(),
  },
  db: {
    collection: (name: string) => ({
      doc: (id?: string) => ({
        id: id ?? "tenant-novo",
        path: `${name}/${id ?? "tenant-novo"}`,
        update: jest.fn(async () => undefined),
      }),
    }),
    runTransaction: async (fn: (tx: unknown) => Promise<void>) =>
      fn({
        set: (ref: { path: string }, data: Record<string, unknown>) =>
          txSets.push({ path: ref.path, data }),
        get: jest.fn(async () => ({ exists: false, data: () => undefined })),
      }),
  },
}));

const syncTenantPlanBillingSnapshot = jest.fn(async (_p: Record<string, unknown>) => undefined);
jest.mock("../../../stripe/stripeWebhook", () => ({
  syncTenantPlanBillingSnapshot: (p: Record<string, unknown>) => syncTenantPlanBillingSnapshot(p),
}));
jest.mock("../../../lib/admin-audit", () => ({ auditAdminAction: jest.fn(async () => undefined) }));
jest.mock("../../../lib/request-auth", () => ({
  isSuperAdminClaim: () => true,
  isTenantAdminClaim: () => true,
}));
jest.mock("../../../lib/contact-validation", () => ({
  validateEmailForSignup: jest.fn(async (email: string) => ({ valid: true, normalizedEmail: email })),
  normalizeBrazilPhoneNumber: () => "",
  validateBrazilMobilePhone: jest.fn(),
}));
jest.mock("../../../lib/whatsapp-eligibility", () => ({
  tenantPlanAllowsWhatsApp: jest.fn(async () => false),
  maybeAutoEnableWhatsApp: jest.fn(),
}));
jest.mock("../../../lib/tenant-plan-policy", () => ({
  clearTenantPlanCache: jest.fn(),
  enforceTenantPlanLimit: jest.fn(),
  getTenantPlanProfile: jest.fn(),
  getTenantUsersUsage: jest.fn(),
  normalizePlanTier: (v: string) =>
    ["free", "starter", "pro", "enterprise"].includes(v) ? v : null,
}));
jest.mock("../../../stripe/stripeConfig", () => ({ getStripe: jest.fn() }));
jest.mock("../../../billing", () => ({ enqueueTenantSync: jest.fn(), isStale: jest.fn() }));
jest.mock("../../../billing/price-drift", () => ({ detectPriceDrift: jest.fn() }));
jest.mock("firebase-admin/storage", () => ({ getStorage: jest.fn() }));
jest.mock("../../../lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { createTenant } from "../admin.controller";

function makeRes() {
  const res: Record<string, unknown> = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res as { status: jest.Mock; json: jest.Mock };
}

async function run(extra: Record<string, unknown>) {
  const res = makeRes();
  await createTenant(
    {
      body: {
        name: "Empresa Teste",
        adminName: "Dono",
        adminEmail: "dono@teste.com",
        adminPassword: "segredo1",
        niche: "cortinas",
        ...extra,
      },
      user: { uid: "sa" },
    } as never,
    res as never,
  );
  return res;
}

const userDoc = () => txSets.find((s) => s.path.startsWith("users/"))?.data;
const tenantDoc = () => txSets.find((s) => s.path.startsWith("tenants/"))?.data;

beforeEach(() => {
  txSets.length = 0;
  setCustomUserClaims.mockClear();
  syncTenantPlanBillingSnapshot.mockClear();
});

describe("createTenant", () => {
  it("conta free nasce com role free (cai no gate de conta gratuita)", async () => {
    const res = await run({ planId: "free" });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(userDoc()).toMatchObject({ role: "free", planId: "free", subscriptionStatus: "free" });
    expect(setCustomUserClaims).toHaveBeenCalledWith("uid-novo", { role: "free", tenantId: "tenant-novo" });
    expect(tenantDoc()).toMatchObject({ isManualSubscription: false });
  });

  it("plano pago vira contrato manual com plano e status no doc do tenant", async () => {
    const res = await run({ planId: "enterprise", currentPeriodEnd: "2099-09-21" });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(userDoc()).toMatchObject({ role: "admin", subscriptionStatus: "active" });
    expect(tenantDoc()).toMatchObject({ isManualSubscription: true });
    expect(syncTenantPlanBillingSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-novo",
        plan: "enterprise",
        subscriptionStatus: "active",
        source: "admin.createTenant",
      }),
    );
  });

  it("plano pago sem data de vencimento e recusado", async () => {
    const res = await run({ planId: "pro" });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(txSets).toHaveLength(0);
  });

  it("plano desconhecido e recusado", async () => {
    const res = await run({ planId: "platinum", currentPeriodEnd: "2099-01-01" });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("status sai da data, nao do que o formulario mandou", async () => {
    await run({ planId: "starter", currentPeriodEnd: "2020-01-01", subscriptionStatus: "active" });
    expect(userDoc()).toMatchObject({ subscriptionStatus: "canceled" });
  });
});
