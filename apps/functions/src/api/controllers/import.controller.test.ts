/**
 * Importação por planilha: mesma permissão de criar do cadastro manual, a
 * prévia não grava, e o teto do plano volta como erro claro.
 */

const svc = {
  importClients: jest.fn(),
  importProducts: jest.fn(),
  importServices: jest.fn(),
};

jest.mock("../services/import/import.service", () => {
  class ImportError extends Error {
    constructor(
      public status: number,
      message: string,
      public code?: string,
    ) {
      super(message);
    }
  }
  return {
    ImportError,
    importClients: (...a: unknown[]) => svc.importClients(...a),
    importProducts: (...a: unknown[]) => svc.importProducts(...a),
    importServices: (...a: unknown[]) => svc.importServices(...a),
  };
});

const hasPagePermission = jest.fn();
jest.mock("../../lib/auth-helpers", () => ({
  hasPagePermission: (...a: unknown[]) => hasPagePermission(...a),
  resolveUserAndTenant: async () => ({ masterRef: { id: "dono" }, isSuperAdmin: false }),
}));
jest.mock("../../lib/logger", () => ({ logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() } }));

import type { Request, Response } from "express";
import { importClientsHandler, importProductsHandler, importServicesHandler } from "./import.controller";

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

function req(body: unknown): Request {
  return { body, path: "/clients/import", user: { uid: "u1", role: "MEMBER", tenantId: "t1" } } as unknown as Request;
}

beforeEach(() => {
  jest.clearAllMocks();
  hasPagePermission.mockResolvedValue(true);
  svc.importClients.mockResolvedValue({ reports: [], created: 0, dryRun: true });
  svc.importProducts.mockResolvedValue({ reports: [], created: 0, dryRun: false });
  svc.importServices.mockResolvedValue({ reports: [], created: 0, dryRun: false });
});

describe("importação por planilha", () => {
  it.each([
    ["contatos", importClientsHandler, "clients"],
    ["produtos", importProductsHandler, "products"],
    ["serviços", importServicesHandler, "services"],
  ] as const)("%s pede canCreate da tela; sem ela, 403 e nada grava", async (_n, handler, page) => {
    hasPagePermission.mockResolvedValue(false);
    const r = res();
    await handler(req({ rows: [{ name: "Ana" }] }), r);
    expect(r.statusCode).toBe(403);
    expect(hasPagePermission).toHaveBeenCalledWith(expect.anything(), page, "canCreate");
    expect(svc.importClients).not.toHaveBeenCalled();
    expect(svc.importProducts).not.toHaveBeenCalled();
    expect(svc.importServices).not.toHaveBeenCalled();
  });

  it("a prévia chega ao serviço com dryRun, no tenant do usuário", async () => {
    await importClientsHandler(req({ rows: [{ name: "Ana" }], dryRun: true }), res());
    expect(svc.importClients).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "t1", uid: "u1", ownerRef: { id: "dono" } }),
      [{ name: "Ana" }],
      true,
    );
  });

  it("produto repassa se o nicho aceita preço por metro", async () => {
    await importProductsHandler(req({ rows: [{ name: "Linho", price: 80 }], allowPerMeter: true }), res());
    expect(svc.importProducts).toHaveBeenCalledWith(expect.anything(), expect.anything(), false, { allowPerMeter: true });
  });

  it.each([
    ["sem linhas", { rows: [] }],
    ["mais de 500 linhas", { rows: Array.from({ length: 501 }, () => ({ name: "x" })) }],
    ["campo desconhecido no corpo", { rows: [{ name: "Ana" }], tenantId: "outro" }],
  ])("%s: 400", async (_n, body) => {
    const r = res();
    await importClientsHandler(req(body), r);
    expect(r.statusCode).toBe(400);
  });

  it("passar do teto do plano volta como 402 com a mensagem", async () => {
    const { ImportError } = jest.requireMock("../services/import/import.service");
    svc.importClients.mockRejectedValue(new ImportError(402, "A planilha passa do limite de contatos do seu plano.", "PLAN_LIMIT_EXCEEDED"));
    const r = res();
    await importClientsHandler(req({ rows: [{ name: "Ana" }] }), r);
    expect(r.statusCode).toBe(402);
    expect(r.body).toMatchObject({ code: "PLAN_LIMIT_EXCEEDED" });
  });
});
