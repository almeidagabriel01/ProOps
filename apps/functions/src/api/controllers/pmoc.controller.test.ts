/**
 * O documento do PMOC: quem vê o contrato gera o link e o PDF; o link público
 * só abre PMOC de verdade, de empresa com o módulo, e não vaza o que é interno.
 */

import type { Request, Response } from "express";

type Doc = Record<string, unknown>;
let store: Record<string, Record<string, Doc>>;
let canView = true;
let hasModule = true;
const pdfCalls: Doc[] = [];

jest.mock("../../lib/auth-helpers", () => ({
  hasPagePermission: async (claims: { role?: string }) => claims.role === "MASTER" || canView,
}));
jest.mock("../../lib/tenant-capabilities", () => ({ tenantHasCapability: async () => hasModule }));
jest.mock("../../lib/frontend-app-url", () => ({ resolveFrontendAppUrl: () => "https://erp.test" }));
jest.mock("../services/core-pdf.service", () => ({
  resolveAppBaseUrl: () => "https://erp.test",
  renderPageToPdfBuffer: async (opts: Doc) => {
    pdfCalls.push(opts);
    return Buffer.from("%PDF-1.4 fake");
  },
}));
jest.mock("../services/field-service/field-service.service", () => ({
  loadOfTenant: async (collection: string, id: string, tenantId: string) => {
    const data = store[collection]?.[id];
    if (!data || data.tenantId !== tenantId) return null;
    return { ref: { id }, data };
  },
  loadClientSnapshot: async () => ({ id: "c1", name: "Clínica", phone: "11999990000", address: "Rua A, 1" }),
}));
jest.mock("../../init", () => {
  const snap = (collection: string, id: string) => {
    const data = store[collection]?.[id];
    return { id, exists: data !== undefined, data: () => data };
  };
  const ref = (collection: string, id: string) => ({ id, path: `${collection}/${id}`, get: async () => snap(collection, id) });
  const query = (name: string, filters: Array<[string, unknown]>) => ({
    where: (f: string, _op: string, v: unknown) => query(name, [...filters, [f, v]]),
    limit: () => query(name, filters),
    get: async () => ({
      docs: Object.entries(store[name] ?? {})
        .filter(([, d]) => filters.every(([f, v]) => d[f] === v))
        .map(([id, d]) => ({ id, data: () => d })),
    }),
  });
  return {
    db: {
      collection: (name: string) => ({
        doc: (id: string) => ref(name, id),
        where: (f: string, op: string, v: unknown) => query(name, []).where(f, op, v),
      }),
      getAll: async (...refs: Array<{ id: string; path: string }>) => refs.map((r) => snap(r.path.split("/")[0], r.id)),
      runTransaction: async (fn: (t: unknown) => Promise<unknown>) =>
        fn({
          get: async (r: { id: string; path: string }) => snap(r.path.split("/")[0], r.id),
          set: (r: { id: string; path: string }, data: Doc) => {
            const c = r.path.split("/")[0];
            store[c] = store[c] ?? {};
            store[c][r.id] = data;
          },
          update: (r: { id: string; path: string }, data: Doc) => {
            const c = r.path.split("/")[0];
            store[c][r.id] = { ...store[c][r.id], ...data };
          },
        }),
    },
  };
});

import { createPmocShareLink, downloadPmocPdf, getSharedPmoc } from "./pmoc.controller";

type MockRes = Response & { statusCode: number; body: Doc; headers: Record<string, string> };

function mockRes(): MockRes {
  const state = { statusCode: 200, body: {} as Doc, headers: {} as Record<string, string> };
  const res = {
    get statusCode() {
      return state.statusCode;
    },
    get body() {
      return state.body;
    },
    get headers() {
      return state.headers;
    },
    status(code: number) {
      state.statusCode = code;
      return res;
    },
    json(body: Doc) {
      state.body = body;
      return res;
    },
    send(body: unknown) {
      state.body = { sent: body };
      return res;
    },
    setHeader(key: string, value: string) {
      state.headers[key] = value;
      return res;
    },
  };
  return res as unknown as MockRes;
}

function req(opts: { role?: string; tenantId?: string; params?: Doc; query?: Doc }): Request {
  return {
    user: { uid: "u1", role: opts.role ?? "MEMBER", tenantId: opts.tenantId ?? "t1" },
    params: opts.params ?? {},
    query: opts.query ?? {},
  } as unknown as Request;
}

const PMOC = {
  responsibleId: "rt1",
  building: { name: "Clínica Centro", address: null, occupants: 40, climatizedArea: 320, use: "Clínica" },
  items: [{ id: "split_filtros", category: "split", text: "Limpar os filtros", frequency: "monthly" }],
  anchorDate: "2026-01-10",
};

beforeEach(() => {
  canView = true;
  hasModule = true;
  pdfCalls.length = 0;
  store = {
    tenants: { t1: { name: "Frio Bom", logoUrl: null, primaryColor: "#0af" } },
    service_contracts: {
      ct1: {
        tenantId: "t1",
        code: "CT-0001",
        title: "PMOC da clínica",
        type: "pmoc",
        status: "active",
        clientId: "c1",
        clientName: "Clínica",
        monthlyAmount: 900,
        wallet: "w1",
        equipmentIds: ["e1"],
        visitPlan: { enabled: true, intervalMonths: 1 },
        pmoc: PMOC,
      },
      ct2: { tenantId: "t1", code: "CT-0002", type: "maintenance", clientId: "c1" },
    },
    technical_responsibles: {
      rt1: {
        tenantId: "t1",
        name: "Carla",
        council: "CREA",
        registryNumber: "SP-1",
        artNumber: "ART-9",
        artValidUntil: "2027-01-01",
        artFile: { path: "tenants/t1/technical_responsibles/rt1/art.pdf", url: "https://files/art.pdf" },
        createdBy: "u-dono",
      },
    },
    customer_equipment: { e1: { tenantId: "t1", clientId: "c1", name: "Split da recepção", type: "Split hi-wall" } },
    service_orders: {
      v1: {
        tenantId: "t1",
        contractId: "ct1",
        code: "OS-0001",
        status: "completed",
        completedAt: "2026-02-10T14:00:00.000Z",
        technicianUids: ["tech-uid"],
        checklist: [{ id: "pmoc_split_filtros", text: "Split: Limpar os filtros", done: true }],
        signature: { name: "Ana", storagePath: "tenants/t1/service_orders/v1/sig.png", ip: "10.0.0.1" },
      },
    },
  };
});

async function shareToken(): Promise<string> {
  const res = mockRes();
  await createPmocShareLink(req({ params: { id: "ct1" } }), res);
  expect(res.statusCode).toBe(200);
  return String(res.body.url).split("/share/pmoc/")[1];
}

describe("link do PMOC", () => {
  it("um link por contrato, reaproveitado", async () => {
    const a = await shareToken();
    const b = await shareToken();
    expect(a).toBe(b);
    expect(store.shared_pmoc[a]).toMatchObject({ tenantId: "t1", contractId: "ct1" });
  });

  it("sem a permissão de ver contratos, não gera", async () => {
    canView = false;
    const res = mockRes();
    await createPmocShareLink(req({ params: { id: "ct1" } }), res);
    expect(res.statusCode).toBe(403);
  });

  it("contrato que não é PMOC e contrato de outra empresa são recusados", async () => {
    const a = mockRes();
    await createPmocShareLink(req({ params: { id: "ct2" } }), a);
    expect(a.statusCode).toBe(400);
    const b = mockRes();
    await createPmocShareLink(req({ params: { id: "ct1" }, tenantId: "t2" }), b);
    expect(b.statusCode).toBe(404);
  });
});

describe("página pública", () => {
  it("mostra o plano e o relatório sem o que é interno", async () => {
    const token = await shareToken();
    const res = mockRes();
    await getSharedPmoc(req({ params: { token }, query: { from: "2026-01-01", to: "2026-12-31" } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.headers["Cache-Control"]).toBe("no-store");
    expect(res.body).toMatchObject({
      contract: { code: "CT-0001", title: "PMOC da clínica" },
      building: { name: "Clínica Centro", address: "Rua A, 1", occupants: 40 },
      responsible: { name: "Carla", council: "CREA", artUrl: "https://files/art.pdf" },
      equipment: [{ name: "Split da recepção", type: "Split hi-wall" }],
      groups: [{ label: "Split", items: [{ text: "Limpar os filtros", frequency: "Mensal" }] }],
      period: { from: "2026-01-01", to: "2026-12-31" },
    });
    expect((res.body.visits as Doc[])[0]).toMatchObject({ code: "OS-0001", signedBy: "Ana" });
    expect((res.body.executions as Doc[])[0]).toMatchObject({ timesDone: 1, lastDoneOn: "2026-02-10" });
    const json = JSON.stringify(res.body);
    for (const leak of ["monthlyAmount", "900", "tech-uid", "storagePath", "10.0.0.1", "u-dono", "technical_responsibles/rt1"]) {
      expect(json).not.toContain(leak);
    }
  });

  it.each([
    ["token desconhecido", async () => "nao-existe-este-token-0000"],
    ["token em formato inválido", async () => "x"],
    [
      "contrato que deixou de ser PMOC",
      async () => {
        const token = await shareToken();
        store.service_contracts.ct1.type = "maintenance";
        return token;
      },
    ],
    [
      "empresa sem o módulo",
      async () => {
        const token = await shareToken();
        hasModule = false;
        return token;
      },
    ],
  ])("%s dá 404", async (_label, makeToken) => {
    const token = await makeToken();
    const res = mockRes();
    await getSharedPmoc(req({ params: { token } }), res);
    expect(res.statusCode).toBe(404);
  });
});

describe("PDF", () => {
  it("o plano imprime a página do link, sem período", async () => {
    const res = mockRes();
    await downloadPmocPdf(req({ params: { id: "ct1" }, query: { kind: "plan" } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toBe("application/pdf");
    const url = new URL(String(pdfCalls[0].url));
    expect(url.pathname).toMatch(/^\/share\/pmoc\/[A-Za-z0-9_-]+$/);
    expect(url.searchParams.get("kind")).toBe("plan");
    expect(url.searchParams.get("from")).toBeNull();
    expect(pdfCalls[0].readySelector).toBe('[data-pdf-pmoc-ready="1"]');
  });

  it("o relatório leva o período pedido; período inválido vira os últimos 12 meses", async () => {
    await downloadPmocPdf(req({ params: { id: "ct1" }, query: { kind: "report", from: "2026-01-01", to: "2026-06-30" } }), mockRes());
    const first = new URL(String(pdfCalls[0].url)).searchParams;
    expect([first.get("kind"), first.get("from"), first.get("to")]).toEqual(["report", "2026-01-01", "2026-06-30"]);

    await downloadPmocPdf(req({ params: { id: "ct1" }, query: { kind: "report", from: "lixo", to: "2026-06-30" } }), mockRes());
    const second = new URL(String(pdfCalls[1].url)).searchParams;
    expect(second.get("from")).not.toBe("lixo");
  });

  it("sem o módulo no plano, 402 sem abrir o Chromium", async () => {
    hasModule = false;
    const res = mockRes();
    await downloadPmocPdf(req({ params: { id: "ct1" } }), res);
    expect(res.statusCode).toBe(402);
    expect(pdfCalls).toHaveLength(0);
  });
});
