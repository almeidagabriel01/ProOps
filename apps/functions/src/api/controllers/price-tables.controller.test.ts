/**
 * Tabelas de preço: CRUD, empresa isolada, permissão de Produtos, validação e
 * a recusa de excluir tabela em uso.
 */

import type { Request, Response } from "express";
import {
  createFakeDb,
  type FakeStore,
} from "../services/price-tables/__tests__/fake-firestore";

const hasPagePermission = jest.fn();
let mockDb: ReturnType<typeof createFakeDb>;
let store: FakeStore;

jest.mock("../../init", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("../../lib/auth-helpers", () => ({
  hasPagePermission: (...a: unknown[]) => hasPagePermission(...a),
}));
jest.mock("../../lib/tenant-doc-cache", () => ({
  getTenantDocCached: async (id: string) => ({
    exists: true,
    data: id === "free-cortinas" ? { niche: "cortinas" } : {},
  }),
}));
jest.mock("../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  createPriceTableHandler,
  deletePriceTableHandler,
  getPriceTableHandler,
  listPriceTableOptionsHandler,
  listPriceTablesHandler,
  updatePriceTableHandler,
} from "./price-tables.controller";
import { DEMO_TENANT_IDS } from "../../shared/demo-tenant";

function fakeRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
  };
  return res as unknown as Response & { statusCode: number; body: Record<string, unknown> };
}

type User = { uid: string; tenantId: string; role: string };
const MEMBER: User = { uid: "u1", tenantId: "t1", role: "MEMBER" };

function req(user: User, params: Record<string, string> = {}, body: unknown = {}) {
  return { user, params, body } as unknown as Request;
}

beforeEach(() => {
  jest.clearAllMocks();
  hasPagePermission.mockResolvedValue(true);
  store = {
    price_tables: {
      vip: {
        tenantId: "t1",
        name: "VIP",
        adjustmentPercent: -10,
        productPrices: { p1: 90 },
        servicePrices: {},
      },
      atacado: { tenantId: "t1", name: "Atacado", adjustmentPercent: -5, productPrices: {} },
      alheia: { tenantId: "outra", name: "Da outra", adjustmentPercent: 50, productPrices: {} },
      [`demo-table`]: {
        tenantId: DEMO_TENANT_IDS.cortinas,
        name: "Exemplo",
        adjustmentPercent: -8,
        productPrices: {},
      },
    },
    products: {
      p1: { tenantId: "t1", name: "Sensor", pricingModel: { mode: "standard" } },
      p2: { tenantId: "t1", name: "Tecido", pricingModel: { mode: "curtain_meter" } },
      faixa: {
        tenantId: "t1",
        name: "Rolô por faixa",
        pricingModel: { mode: "curtain_height", tiers: [] },
      },
      pOutra: { tenantId: "outra", name: "Alheio" },
    },
    services: { s1: { tenantId: "t1", name: "Instalação" } },
    clients: {
      c1: { tenantId: "t1", name: "Ana", priceTableId: "vip" },
      c2: { tenantId: "t1", name: "Bia", priceTableId: "vip" },
      c3: { tenantId: "outra", name: "Cris", priceTableId: "atacado" },
    },
  };
  mockDb = createFakeDb(store);
});

describe("listar", () => {
  it("lista só as tabelas da empresa, por nome", async () => {
    const res = fakeRes();
    await listPriceTablesHandler(req(MEMBER), res);
    expect(res.statusCode).toBe(200);
    const tables = res.body.priceTables as Array<{ id: string; name: string }>;
    expect(tables.map((t) => t.id)).toEqual(["atacado", "vip"]);
    expect(hasPagePermission).toHaveBeenCalledWith(MEMBER, "products", "canView");
  });

  it("membro sem ver Produtos leva 403", async () => {
    hasPagePermission.mockResolvedValue(false);
    const res = fakeRes();
    await listPriceTablesHandler(req(MEMBER), res);
    expect(res.statusCode).toBe(403);
  });

  it("as opções do seletor do contato não pedem permissão de Produtos nem trazem preços", async () => {
    hasPagePermission.mockResolvedValue(false);
    const res = fakeRes();
    await listPriceTableOptionsHandler(req(MEMBER), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.options).toEqual([
      { id: "atacado", name: "Atacado", adjustmentPercent: -5 },
      { id: "vip", name: "VIP", adjustmentPercent: -10 },
    ]);
    expect(hasPagePermission).not.toHaveBeenCalled();
  });

  it("a conta free lê a tabela de exemplo do nicho dela, não o tenant próprio", async () => {
    const res = fakeRes();
    await listPriceTablesHandler(req({ uid: "f1", tenantId: "free-cortinas", role: "free" }), res);
    expect(res.statusCode).toBe(200);
    expect((res.body.priceTables as Array<{ id: string }>).map((t) => t.id)).toEqual([
      "demo-table",
    ]);
  });
});

describe("ler uma tabela", () => {
  it("qualquer pessoa da empresa lê a tabela de um cliente (vale na proposta)", async () => {
    hasPagePermission.mockResolvedValue(false);
    const res = fakeRes();
    await getPriceTableHandler(req(MEMBER, { id: "vip" }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.priceTable).toMatchObject({
      id: "vip",
      adjustmentPercent: -10,
      productPrices: { p1: 90 },
    });
  });

  it("tabela de outra empresa responde 404, como a inexistente", async () => {
    const alheia = fakeRes();
    await getPriceTableHandler(req(MEMBER, { id: "alheia" }), alheia);
    expect(alheia.statusCode).toBe(404);
    const nenhuma = fakeRes();
    await getPriceTableHandler(req(MEMBER, { id: "nao-existe" }), nenhuma);
    expect(nenhuma.statusCode).toBe(404);
  });
});

describe("criar", () => {
  it("grava na empresa do token, com autor, preços arredondados a centavo", async () => {
    const res = fakeRes();
    await createPriceTableHandler(
      req(MEMBER, {}, {
        name: "  Construtora   X ",
        adjustmentPercent: -7.555,
        productPrices: { p1: 99.999, p2: 45 },
        servicePrices: { s1: 120 },
      }),
      res,
    );
    expect(res.statusCode).toBe(201);
    const created = res.body.priceTable as { id: string };
    expect(store.price_tables[created.id]).toMatchObject({
      tenantId: "t1",
      name: "Construtora X",
      adjustmentPercent: -7.56,
      productPrices: { p1: 100, p2: 45 },
      servicePrices: { s1: 120 },
      createdBy: "u1",
    });
    expect(hasPagePermission).toHaveBeenCalledWith(MEMBER, "products", "canCreate");
  });

  it("ignora o tenantId do corpo: campo a mais é recusado", async () => {
    const res = fakeRes();
    await createPriceTableHandler(req(MEMBER, {}, { name: "X", tenantId: "outra" }), res);
    expect(res.statusCode).toBe(400);
  });

  it.each([
    [{ name: "" }, "Informe o nome"],
    [{ name: "X", adjustmentPercent: -100 }, "menor que 100%"],
    [{ name: "X", adjustmentPercent: 1001 }, "1000%"],
    [{ name: "X", productPrices: { p1: 0 } }, "maior que zero"],
    [{ name: "X", productPrices: { p1: -3 } }, "maior que zero"],
  ])("recusa dado inválido %j", async (body, message) => {
    const res = fakeRes();
    await createPriceTableHandler(req(MEMBER, {}, body), res);
    expect(res.statusCode).toBe(400);
    expect(String(res.body.message)).toContain(message);
  });

  it("recusa preço próprio de produto de outra empresa ou inexistente", async () => {
    for (const id of ["pOutra", "fantasma"]) {
      const res = fakeRes();
      await createPriceTableHandler(req(MEMBER, {}, { name: "X", productPrices: { [id]: 10 } }), res);
      expect(res.statusCode).toBe(400);
    }
  });

  it("recusa preço próprio em produto por faixa de altura: nele vale só o percentual", async () => {
    const res = fakeRes();
    await createPriceTableHandler(
      req(MEMBER, {}, { name: "X", productPrices: { faixa: 10 } }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(String(res.body.message)).toContain("faixa de altura");
  });

  it("membro sem criar produtos leva 403 e nada é gravado", async () => {
    hasPagePermission.mockImplementation(async (_u: unknown, _p: string, a: string) => a === "canView");
    const res = fakeRes();
    await createPriceTableHandler(req(MEMBER, {}, { name: "X" }), res);
    expect(res.statusCode).toBe(403);
    expect(Object.keys(store.price_tables)).toHaveLength(4);
  });

  it("a conta free não cria (somente leitura)", async () => {
    const res = fakeRes();
    await createPriceTableHandler(req({ uid: "f1", tenantId: "free-cortinas", role: "free" }, {}, { name: "X" }), res);
    expect(res.statusCode).toBe(403);
  });
});

describe("editar", () => {
  it("altera só o que veio", async () => {
    const res = fakeRes();
    await updatePriceTableHandler(req(MEMBER, { id: "vip" }, { adjustmentPercent: 12 }), res);
    expect(res.statusCode).toBe(200);
    expect(store.price_tables.vip).toMatchObject({
      name: "VIP",
      adjustmentPercent: 12,
      productPrices: { p1: 90 },
      updatedBy: "u1",
    });
    expect(hasPagePermission).toHaveBeenCalledWith(MEMBER, "products", "canEdit");
  });

  it("membro sem editar produtos leva 403", async () => {
    hasPagePermission.mockImplementation(async (_u: unknown, _p: string, a: string) => a !== "canEdit");
    const res = fakeRes();
    await updatePriceTableHandler(req(MEMBER, { id: "vip" }, { adjustmentPercent: 12 }), res);
    expect(res.statusCode).toBe(403);
    expect(store.price_tables.vip.adjustmentPercent).toBe(-10);
  });

  it("não edita tabela de outra empresa", async () => {
    const res = fakeRes();
    await updatePriceTableHandler(req(MEMBER, { id: "alheia" }, { name: "Minha" }), res);
    expect(res.statusCode).toBe(404);
    expect(store.price_tables.alheia.name).toBe("Da outra");
  });

  it("corpo vazio é recusado", async () => {
    const res = fakeRes();
    await updatePriceTableHandler(req(MEMBER, { id: "vip" }, {}), res);
    expect(res.statusCode).toBe(400);
  });
});

describe("excluir", () => {
  it("recusa tabela em uso, dizendo quantos clientes a usam", async () => {
    const res = fakeRes();
    await deletePriceTableHandler(req(MEMBER, { id: "vip" }), res);
    expect(res.statusCode).toBe(409);
    expect(String(res.body.message)).toContain("2 clientes");
    expect(store.price_tables.vip).toBeDefined();
  });

  it("cliente de OUTRA empresa usando o mesmo id não conta", async () => {
    const res = fakeRes();
    await deletePriceTableHandler(req(MEMBER, { id: "atacado" }), res);
    expect(res.statusCode).toBe(200);
    expect(store.price_tables.atacado).toBeUndefined();
  });

  it("membro sem excluir produtos leva 403", async () => {
    hasPagePermission.mockImplementation(async (_u: unknown, _p: string, a: string) => a !== "canDelete");
    const res = fakeRes();
    await deletePriceTableHandler(req(MEMBER, { id: "atacado" }), res);
    expect(res.statusCode).toBe(403);
    expect(store.price_tables.atacado).toBeDefined();
  });

  it("não exclui tabela de outra empresa", async () => {
    const res = fakeRes();
    await deletePriceTableHandler(req(MEMBER, { id: "alheia" }), res);
    expect(res.statusCode).toBe(404);
    expect(store.price_tables.alheia).toBeDefined();
  });
});
