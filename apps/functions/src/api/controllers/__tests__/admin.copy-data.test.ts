/**
 * copyTenantData: as guardas que impedem o "copiar dados" de apagar catalogo.
 *
 * Antes, o handler apagava produtos/servicos/ambientes/sistemas do destino
 * ANTES de copiar e nao comparava origem com destino: com os dois ids iguais,
 * o catalogo inteiro da empresa sumia e nada voltava.
 */

const deletedRefs: string[] = [];
const setRefs: string[] = [];
let newIdSeq = 0;

type Doc = { id: string; data: Record<string, unknown> };
const store: Record<string, Doc[]> = {};

function makeQuery(collection: string, tenantId?: string) {
  const docs = () =>
    (store[collection] || []).filter((d) => !tenantId || d.data.tenantId === tenantId);
  const snap = () => {
    const list = docs().map((d) => ({
      id: d.id,
      ref: { id: d.id, path: `${collection}/${d.id}` },
      data: () => d.data,
    }));
    return { empty: list.length === 0, docs: list };
  };
  return {
    where: (_f: string, _op: string, value: string) => makeQuery(collection, value),
    select: () => ({ get: async () => snap() }),
    get: async () => snap(),
  };
}

jest.mock("../../../init", () => ({
  auth: {},
  db: {
    collection: (name: string) => ({
      ...makeQuery(name),
      doc: (id?: string) => ({
        id: id ?? `new-${++newIdSeq}`,
        path: `${name}/${id ?? `new-${newIdSeq}`}`,
      }),
    }),
    batch: () => ({
      set: (ref: { path: string }) => setRefs.push(ref.path),
      delete: (ref: { path: string }) => deletedRefs.push(ref.path),
      commit: async () => undefined,
    }),
  },
}));

const assertTenantExists = jest.fn(async (_id: string) => undefined);
jest.mock("../../../lib/tenant-resolution", () => ({
  assertTenantExists: (id: string) => assertTenantExists(id),
}));

const auditAdminAction = jest.fn(async () => undefined);
jest.mock("../../../lib/admin-audit", () => ({
  auditAdminAction: (...args: unknown[]) => auditAdminAction(...(args as [])),
}));

jest.mock("../../../lib/request-auth", () => ({
  isSuperAdminClaim: () => true,
  isTenantAdminClaim: () => true,
}));

jest.mock("../../../stripe/stripeWebhook", () => ({ syncTenantPlanBillingSnapshot: jest.fn() }));
jest.mock("../../../stripe/stripeConfig", () => ({ getStripe: jest.fn() }));
jest.mock("../../../billing", () => ({ enqueueTenantSync: jest.fn(), isStale: jest.fn() }));
jest.mock("../../../billing/price-drift", () => ({ detectPriceDrift: jest.fn() }));
jest.mock("firebase-admin/storage", () => ({ getStorage: jest.fn() }));
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: jest.fn(), delete: jest.fn() },
  Timestamp: { now: () => ({ toDate: () => new Date("2026-09-21T00:00:00Z") }) },
}));
jest.mock("../../../lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { copyTenantData } from "../admin.controller";

function makeRes() {
  const res: Record<string, unknown> = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res as { status: jest.Mock; json: jest.Mock };
}

function run(body: Record<string, unknown>) {
  const res = makeRes();
  const req = { body, user: { uid: "sa" }, originalUrl: "/v1/admin/tenants/copy-data" };
  return copyTenantData(req as never, res as never).then(() => res);
}

beforeEach(() => {
  deletedRefs.length = 0;
  setRefs.length = 0;
  newIdSeq = 0;
  assertTenantExists.mockReset().mockResolvedValue(undefined);
  auditAdminAction.mockClear();
  for (const key of Object.keys(store)) delete store[key];
  store.products = [
    { id: "p-src", data: { tenantId: "src", name: "Cortina" } },
    { id: "p-old", data: { tenantId: "dst", name: "Antigo" } },
  ];
});

describe("copyTenantData", () => {
  it("origem igual ao destino: 400 e nada apagado (o caso que zerava o catalogo)", async () => {
    const res = await run({ sourceTenantId: "src", targetTenantId: "src", replace: true });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(deletedRefs).toEqual([]);
    expect(setRefs).toEqual([]);
  });

  it("empresa inexistente: 400 sem tocar em nada", async () => {
    assertTenantExists.mockRejectedValueOnce(new Error("Empresa inválida ou inexistente."));
    const res = await run({ sourceTenantId: "src", targetTenantId: "fantasma" });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(deletedRefs).toEqual([]);
  });

  it("sem replace: copia e preserva o que o destino ja tinha", async () => {
    const res = await run({ sourceTenantId: "src", targetTenantId: "dst" });
    expect(res.status).not.toHaveBeenCalled();
    expect(setRefs).toHaveLength(1);
    expect(deletedRefs).toEqual([]);
    expect(auditAdminAction).toHaveBeenCalledWith(
      expect.anything(),
      "super_admin_copy_data",
      expect.objectContaining({ tenantId: "dst", targetId: "src" }),
    );
  });

  it("com replace: apaga so os antigos do destino, depois da copia", async () => {
    await run({ sourceTenantId: "src", targetTenantId: "dst", replace: true });
    expect(setRefs).toHaveLength(1);
    expect(deletedRefs).toEqual(["products/p-old"]);
  });
});
