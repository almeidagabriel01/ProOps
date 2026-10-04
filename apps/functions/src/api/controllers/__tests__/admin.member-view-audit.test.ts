/**
 * "Ver como membro": o inicio e o fim ficam na auditoria com o membro visto,
 * e o inicio recusa membro que nao e da empresa (o cabecalho vem do navegador).
 */

let memberDoc: Record<string, unknown> | null = null;

jest.mock("../../../init", () => ({
  auth: {},
  db: {
    collection: () => ({
      doc: () => ({
        get: async () => ({
          exists: memberDoc !== null,
          data: () => memberDoc,
        }),
      }),
    }),
  },
}));

const auditAdminAction = jest.fn(async () => undefined);
jest.mock("../../../lib/admin-audit", () => ({
  auditAdminAction: (...a: unknown[]) => auditAdminAction(...(a as [])),
}));
const writeSecurityAuditEvent = jest.fn(async () => undefined);
const incrementSecurityCounter = jest.fn(async () => undefined);
jest.mock("../../../lib/security-observability", () => ({
  writeSecurityAuditEvent: (...a: unknown[]) => writeSecurityAuditEvent(...(a as [])),
  incrementSecurityCounter: (...a: unknown[]) => incrementSecurityCounter(...(a as [])),
}));
jest.mock("../../../lib/tenant-resolution", () => ({ assertTenantExists: jest.fn(async () => undefined) }));
jest.mock("../../../lib/request-auth", () => ({
  isSuperAdminClaim: () => true,
  isTenantAdminClaim: () => true,
}));
jest.mock("../../../stripe/stripeWebhook", () => ({ syncTenantPlanBillingSnapshot: jest.fn() }));
jest.mock("../../../stripe/stripeConfig", () => ({ getStripe: jest.fn() }));
jest.mock("../../../billing", () => ({ enqueueTenantSync: jest.fn(), isStale: jest.fn() }));
jest.mock("../../../billing/price-drift", () => ({ detectPriceDrift: jest.fn() }));
jest.mock("firebase-admin/storage", () => ({ getStorage: jest.fn() }));
jest.mock("../../../lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { startImpersonation, stopImpersonation } from "../admin.controller";

function makeRes() {
  const res: Record<string, unknown> = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res as { status: jest.Mock; json: jest.Mock };
}

async function call(handler: typeof startImpersonation, body: Record<string, unknown>) {
  const res = makeRes();
  await handler({ body, user: { uid: "sa" }, originalUrl: "/v1/admin/x" } as never, res as never);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  memberDoc = { role: "MEMBER", tenantId: "t1", masterId: "dono" };
});

describe("auditoria do ver como membro", () => {
  it("inicio grava o membro visto, sem o evento de inicio da empresa", async () => {
    const res = await call(startImpersonation, { tenantId: "t1", memberUid: "vendedor" });
    expect(res.status).not.toHaveBeenCalled();
    expect(auditAdminAction).toHaveBeenCalledWith(
      expect.anything(),
      "super_admin_member_view_started",
      { tenantId: "t1", targetId: "vendedor" },
    );
    expect(writeSecurityAuditEvent).not.toHaveBeenCalled();
  });

  it.each([
    ["de outra empresa", { role: "MEMBER", tenantId: "t2" }],
    ["superadmin", { role: "SUPERADMIN", tenantId: "t1" }],
    ["inexistente", null],
  ])("inicio recusa membro %s", async (_label, doc) => {
    memberDoc = doc;
    const res = await call(startImpersonation, { tenantId: "t1", memberUid: "x" });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(auditAdminAction).not.toHaveBeenCalled();
  });

  it("fim grava o membro e o motivo", async () => {
    await call(stopImpersonation, { tenantId: "t1", memberUid: "vendedor", reason: "switch" });
    expect(auditAdminAction).toHaveBeenCalledWith(
      expect.anything(),
      "super_admin_member_view_stopped",
      { tenantId: "t1", targetId: "vendedor", reason: "switch" },
    );
  });

  it("sem membro continua o fluxo da empresa", async () => {
    await call(startImpersonation, { tenantId: "t1" });
    expect(writeSecurityAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "super_admin_impersonation_started", tenantId: "t1" }),
    );
    expect(auditAdminAction).not.toHaveBeenCalled();
  });
});
