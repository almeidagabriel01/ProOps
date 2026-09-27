/**
 * DRE e categorias seguem a permissão de Lançamentos, e a conta free lê o
 * exemplo do tenant de demonstração, sem escrever.
 */

const svc = {
  listCategories: jest.fn(),
  createCategory: jest.fn(),
  updateCategory: jest.fn(),
  deleteCategory: jest.fn(),
  buildDre: jest.fn(),
};

jest.mock("../services/finance-reports/transaction-categories", () => {
  class CategoryError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    CategoryError,
    listCategories: (...a: unknown[]) => svc.listCategories(...a),
    createCategory: (...a: unknown[]) => svc.createCategory(...a),
    updateCategory: (...a: unknown[]) => svc.updateCategory(...a),
    deleteCategory: (...a: unknown[]) => svc.deleteCategory(...a),
  };
});
jest.mock("../services/finance-reports/dre.service", () => {
  class DreError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  }
  return { DreError, buildDre: (...a: unknown[]) => svc.buildDre(...a) };
});

const accountNiche: { value: unknown } = { value: "automacao_residencial" };
jest.mock("../../lib/tenant-doc-cache", () => ({
  getTenantDocCached: async () => ({ exists: true, data: { niche: accountNiche.value } }),
}));

const hasPagePermission = jest.fn();
jest.mock("../../lib/auth-helpers", () => ({
  hasPagePermission: (...a: unknown[]) => hasPagePermission(...a),
}));

import type { Request, Response } from "express";
import {
  createTransactionCategory,
  deleteTransactionCategory,
  getDre,
  getTransactionCategories,
  updateTransactionCategory,
} from "./finance-reports.controller";

interface FakeResponse {
  statusCode: number;
  body: Record<string, unknown>;
  status: (code: number) => FakeResponse;
  json: (body: Record<string, unknown>) => FakeResponse;
}

function res(): FakeResponse & Response {
  const r: FakeResponse = {
    statusCode: 200,
    body: {},
    status: (code) => {
      r.statusCode = code;
      return r;
    },
    json: (body) => {
      r.body = body;
      return r;
    },
  };
  return r as FakeResponse & Response;
}

function req(extra: Partial<Request> = {}, role = "MEMBER"): Request {
  return {
    params: { id: "cat1" },
    query: {},
    body: {},
    user: { uid: "u1", role, tenantId: "t1" },
    ...extra,
  } as unknown as Request;
}

beforeEach(() => {
  jest.clearAllMocks();
  hasPagePermission.mockResolvedValue(true);
  svc.listCategories.mockResolvedValue([]);
  svc.buildDre.mockResolvedValue({ months: [] });
  svc.updateCategory.mockResolvedValue({ category: {}, renamed: 0 });
});

describe("permissão de Lançamentos", () => {
  it.each([
    ["ler categorias", getTransactionCategories, req(), "canView"],
    ["DRE", getDre, req({ query: { from: "2026-01", to: "2026-03" } } as Partial<Request>), "canView"],
    ["criar categoria", createTransactionCategory, req({ body: { name: "Frete", kind: "expense" } }), "canCreate"],
    ["alterar categoria", updateTransactionCategory, req({ body: { group: "cost" } }), "canEdit"],
    ["excluir categoria", deleteTransactionCategory, req(), "canDelete"],
  ] as const)("%s pede %s; sem ela, 403", async (_name, handler, request, action) => {
    hasPagePermission.mockResolvedValue(false);
    const r = res();
    await handler(request, r);
    expect(r.statusCode).toBe(403);
    expect(hasPagePermission).toHaveBeenCalledWith(expect.anything(), "transactions", action);
  });

  it("DRE usa o tenant do usuário e caixa como padrão", async () => {
    await getDre(req({ query: { from: "2026-01", to: "2026-03", tenantId: "outro" } } as Partial<Request>), res());
    expect(svc.buildDre).toHaveBeenCalledWith("t1", { from: "2026-01", to: "2026-03", basis: "cash" });
  });
});

describe("validação", () => {
  it("grupo de despesa não serve para receita é problema do serviço; grupo inexistente é 400 aqui", async () => {
    const r = res();
    await createTransactionCategory(req({ body: { name: "X", kind: "income", group: "lucro" } }), r);
    expect(r.statusCode).toBe(400);
    expect(svc.createCategory).not.toHaveBeenCalled();
  });

  it("alteração vazia é 400", async () => {
    const r = res();
    await updateTransactionCategory(req({ body: {} }), r);
    expect(r.statusCode).toBe(400);
  });

  it("período inválido do serviço volta como 400", async () => {
    const { DreError } = jest.requireMock("../services/finance-reports/dre.service");
    svc.buildDre.mockRejectedValue(new DreError(400, "O período vai até 12 meses."));
    const r = res();
    await getDre(req({ query: { from: "2025-01", to: "2026-12" } } as Partial<Request>), r);
    expect(r.statusCode).toBe(400);
    expect(r.body.message).toMatch(/12 meses/);
  });
});

describe("conta free (demonstração)", () => {
  it("lê o DRE e as categorias do tenant de exemplo, sem checar permissão", async () => {
    await getDre(req({ query: { from: "2026-01", to: "2026-03" } } as Partial<Request>, "free"), res());
    expect(svc.buildDre).toHaveBeenCalledWith("demo", expect.anything());
    await getTransactionCategories(req({}, "free"), res());
    expect(svc.listCategories).toHaveBeenCalledWith("demo");
    expect(hasPagePermission).not.toHaveBeenCalled();
  });

  it("a demonstração é a do nicho da conta", async () => {
    accountNiche.value = "cortinas";
    svc.listCategories.mockClear();
    await getTransactionCategories(req({}, "free"), res());
    expect(svc.listCategories).toHaveBeenCalledWith("demo-cortinas");

    accountNiche.value = "nicho-que-nao-existe";
    svc.listCategories.mockClear();
    await getTransactionCategories(req({}, "free"), res());
    expect(svc.listCategories).toHaveBeenCalledWith("demo");
    accountNiche.value = "automacao_residencial";
  });

  it("não escreve", async () => {
    const r = res();
    await createTransactionCategory(req({ body: { name: "Frete", kind: "expense" } }, "free"), r);
    expect(r.statusCode).toBe(403);
    expect(svc.createCategory).not.toHaveBeenCalled();
  });
});
