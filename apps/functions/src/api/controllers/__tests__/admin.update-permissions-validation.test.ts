/**
 * `PUT /v1/admin/members/permissions` gravava qualquer pageId e qualquer
 * chave. Uma chave inventada não abre nada, mas fica no documento parecendo
 * permissão (foi assim que a chave fantasma `financial` fechou o financeiro
 * de todo membro por meses). Agora só passam as páginas da tela de Equipe e
 * as quatro ações.
 */

const sets: Array<{ path: string; data: Record<string, unknown> }> = [];

jest.mock("../../../init", () => {
  const permissionsCollection = (uid: string) => ({
    doc: (pageId: string) => ({
      path: `users/${uid}/permissions/${pageId}`,
      get: async () => ({ exists: false, data: () => ({}) }),
      set: async (data: Record<string, unknown>) => {
        sets.push({ path: `users/${uid}/permissions/${pageId}`, data });
      },
    }),
  });
  return {
    auth: {},
    db: {
      collection: () => ({
        doc: (uid: string) => ({
          get: async () => ({
            exists: true,
            data: () => ({ masterId: "dono", tenantId: "t1" }),
          }),
          collection: () => permissionsCollection(uid),
        }),
      }),
      batch: () => {
        const pending: Array<{ path: string; data: Record<string, unknown> }> = [];
        return {
          set: (ref: { path: string }, data: Record<string, unknown>) => pending.push({ path: ref.path, data }),
          commit: async () => {
            sets.push(...pending);
          },
        };
      },
    },
  };
});
jest.mock("../../../lib/admin-audit", () => ({ auditAdminAction: jest.fn(async () => undefined) }));
jest.mock("../../../lib/request-auth", () => ({
  isSuperAdminClaim: () => false,
  isTenantAdminClaim: () => true,
}));
jest.mock("../../services/notification-audience", () => ({ invalidateTenantAudience: jest.fn() }));
jest.mock("../../../stripe/stripeWebhook", () => ({ syncTenantPlanBillingSnapshot: jest.fn() }));
jest.mock("../../../stripe/stripeConfig", () => ({ getStripe: jest.fn() }));
jest.mock("../../../billing", () => ({ enqueueTenantSync: jest.fn(), isStale: jest.fn() }));
jest.mock("../../../billing/price-drift", () => ({ detectPriceDrift: jest.fn() }));
jest.mock("firebase-admin/storage", () => ({ getStorage: jest.fn() }));
jest.mock("../../../lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { updatePermissions } from "../admin.controller";

function makeRes() {
  const res: Record<string, unknown> = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res as { status: jest.Mock; json: jest.Mock };
}

async function run(body: Record<string, unknown>) {
  const res = makeRes();
  await updatePermissions({ body: { targetUserId: "ana", ...body }, user: { uid: "dono", tenantId: "t1" } } as never, res as never);
  return res;
}

beforeEach(() => {
  sets.length = 0;
});

describe("updatePermissions: só páginas e ações conhecidas", () => {
  it("modo single com página inventada é recusado", async () => {
    const res = await run({ mode: "single", pageId: "financial", key: "canView", value: true });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(sets).toHaveLength(0);
  });

  it("modo single com chave inventada é recusado", async () => {
    const res = await run({ mode: "single", pageId: "proposals", key: "canApproveEverything", value: true });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(sets).toHaveLength(0);
  });

  it("modo single com valor que não é booleano é recusado", async () => {
    const res = await run({ mode: "single", pageId: "proposals", key: "canView", value: "sim" });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("modo bulk com uma página inventada não grava nenhuma", async () => {
    const res = await run({
      permissions: { proposals: { canView: true }, financial: { canView: true } },
    });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(sets).toHaveLength(0);
  });

  it("página e ação conhecidas são gravadas", async () => {
    const single = await run({ mode: "single", pageId: "service_orders_all", key: "canView", value: true });
    expect(single.status).not.toHaveBeenCalled();
    const bulk = await run({ permissions: { proposals: { canView: true, canEdit: true } } });
    expect(bulk.status).not.toHaveBeenCalled();
    expect(sets.map((s) => s.path)).toEqual([
      "users/ana/permissions/service_orders_all",
      "users/ana/permissions/proposals",
    ]);
  });
});
