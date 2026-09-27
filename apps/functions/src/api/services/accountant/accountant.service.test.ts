/**
 * O token do contador abre o financeiro de UMA empresa. Estes testes cuidam da
 * fronteira: sem o financeiro no plano o link não abre, e um arquivo de nota
 * só sai se a nota for daquela empresa.
 */

type Row = Record<string, unknown>;
const store: Record<string, Record<string, Row>> = {};
const capabilities: Record<string, boolean> = {};
const files: Record<string, Buffer> = {};

function snap(collection: string, id: string) {
  const data = store[collection]?.[id];
  return { id, exists: data !== undefined, data: () => data };
}

function query(collection: string, filters: Array<[string, unknown]>) {
  return {
    where: (field: string, op: string, value: unknown) => query(collection, op === "==" ? [...filters, [field, value]] : filters),
    orderBy: () => query(collection, filters),
    limit: () => query(collection, filters),
    get: async () => {
      const docs = Object.entries(store[collection] ?? {})
        .filter(([, row]) => filters.every(([f, v]) => row[f] === v))
        .map(([id]) => snap(collection, id));
      return { docs, size: docs.length };
    },
  };
}

jest.mock("../../../init", () => ({
  db: {
    collection: (name: string) => ({
      doc: (id: string) => ({ get: async () => snap(name, id), update: jest.fn(async () => undefined) }),
      where: (field: string, _op: string, value: unknown) => query(name, [[field, value]]),
    }),
  },
}));
jest.mock("firebase-admin/storage", () => ({
  getStorage: () => ({
    bucket: () => ({
      file: (path: string) => ({
        exists: async () => [path in files],
        download: async () => [files[path]],
      }),
    }),
  }),
}));
jest.mock("../../../lib/frontend-app-url", () => ({ resolveFrontendAppOrigin: () => "https://erp.test" }));
jest.mock("../../../lib/tenant-capabilities", () => ({
  tenantHasCapability: async (tenantId: string, capability: string) => capabilities[`${tenantId}:${capability}`] === true,
}));
jest.mock("../finance-reports/dre.service", () => ({
  buildDre: jest.fn(async () => ({ months: [] })),
  brazilMonthStartIso: (m: string) => `${m}-01T03:00:00.000Z`,
  nextMonth: (m: string) => m,
  validateRange: jest.fn(),
}));

import { accountantDocument, accountantDre, resolveAccountantToken } from "./accountant.service";

const TOKEN = "tokentokentoken123456";

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
  for (const key of Object.keys(capabilities)) delete capabilities[key];
  for (const key of Object.keys(files)) delete files[key];
  capabilities["alpha:financial"] = true;
  capabilities["alpha:fiscal"] = true;
  store.accountant_links = { alpha: { tenantId: "alpha", token: TOKEN } };
  store.invoices = {
    n1: { tenantId: "alpha", status: "authorized", numero: 10, storagePdfPath: "p/n1.pdf", xmlUrl: "https://focus/n1.xml" },
    n_beta: { tenantId: "beta", status: "authorized", storagePdfPath: "p/beta.pdf" },
    n_rascunho: { tenantId: "alpha", status: "draft", storagePdfPath: "p/r.pdf" },
  };
  store.received_invoices = { r1: { tenantId: "alpha", storageXmlPath: "p/r1.xml" } };
  files["p/n1.pdf"] = Buffer.from("pdf");
  files["p/beta.pdf"] = Buffer.from("beta");
  files["p/r1.xml"] = Buffer.from("<xml/>");
});

describe("link do contador", () => {
  it("abre só com o financeiro no plano; as seções de nota seguem o plano de cada uma", async () => {
    await expect(resolveAccountantToken(TOKEN)).resolves.toMatchObject({ tenantId: "alpha", sections: { invoices: true, received: false } });
    capabilities["alpha:financial"] = false;
    await expect(resolveAccountantToken(TOKEN)).rejects.toMatchObject({ status: 404 });
  });

  it("token inexistente ou malformado: 404", async () => {
    await expect(resolveAccountantToken("naoexiste0000000000")).rejects.toMatchObject({ status: 404 });
    await expect(resolveAccountantToken("../x")).rejects.toMatchObject({ status: 404 });
  });

  it("o DRE é o da empresa do link", async () => {
    const { buildDre } = jest.requireMock("../finance-reports/dre.service");
    await accountantDre(TOKEN, { from: "2026-09", to: "2026-09", basis: "cash" });
    expect(buildDre).toHaveBeenCalledWith("alpha", { from: "2026-09", to: "2026-09", basis: "cash" });
  });
});

describe("arquivos das notas", () => {
  it("PDF da cópia do Storage; XML sem cópia vai para o provedor", async () => {
    await expect(accountantDocument(TOKEN, "invoice", "n1", "pdf")).resolves.toEqual({ buffer: Buffer.from("pdf"), fileName: "nota-10.pdf" });
    await expect(accountantDocument(TOKEN, "invoice", "n1", "xml")).resolves.toEqual({ redirect: "https://focus/n1.xml" });
  });

  it.each([
    ["nota de outra empresa", "invoice", "n_beta"],
    ["nota em rascunho", "invoice", "n_rascunho"],
    ["id com barra", "invoice", "a/b"],
    ["inexistente", "invoice", "nada"],
  ] as const)("%s: 404", async (_n, source, id) => {
    await expect(accountantDocument(TOKEN, source, id, "pdf")).rejects.toMatchObject({ status: 404 });
  });

  it("nota de entrada só com a recepção no plano", async () => {
    await expect(accountantDocument(TOKEN, "received", "r1", "xml")).rejects.toMatchObject({ status: 404 });
    capabilities["alpha:fiscalReceiving"] = true;
    await expect(accountantDocument(TOKEN, "received", "r1", "xml")).resolves.toMatchObject({ fileName: "entrada-r1.xml" });
  });
});
