/**
 * Tabela de preço no cadastro do contato (`clients.priceTableId`): o id vem
 * do navegador, então o backend confere que a tabela é da mesma empresa, que
 * o contato é cliente e que o plano tem o módulo. Voltar para a tabela padrão
 * (`null`) é sempre permitido.
 */

import type { Request, Response } from "express";
import {
  createFakeDb,
  type FakeStore,
} from "../services/price-tables/__tests__/fake-firestore";

let mockDb: ReturnType<typeof createFakeDb>;
let store: FakeStore;
const mockHasCapability = jest.fn();

jest.mock("../../init", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { delete: () => ({ __delete: true }), increment: (n: number) => ({ __inc: n }) },
  Timestamp: { now: () => "agora" },
}));
jest.mock("../../lib/auth-helpers", () => ({
  recordInScope: async () => true,
  resolveUserAndTenant: async () => ({
    userData: { tenantId: "t1" },
    masterData: { tenantId: "t1" },
    masterRef: mockDb.collection("users").doc("master"),
    isMaster: true,
    isSuperAdmin: false,
    tenantId: "t1",
  }),
  checkPermission: async () => true,
}));
jest.mock("../../lib/tenant-plan-policy", () => ({
  enforceTenantPlanLimit: async () => ({ allowed: true }),
  getTenantClientsUsage: async () => 0,
}));
jest.mock("../../lib/tenant-resolution", () => ({
  assertTenantExists: async () => undefined,
  auditSuperAdminCrossTenantWrite: () => undefined,
}));
jest.mock("../../lib/tenant-capabilities", () => ({
  tenantHasCapability: (...a: unknown[]) => mockHasCapability(...a),
}));
jest.mock("../../lib/security-observability", () => ({
  incrementSecurityCounter: jest.fn().mockResolvedValue(undefined),
  writeSecurityAuditEvent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../lib/search-tokens", () => ({ buildClientSearchTokens: () => [] }));

import { createClient, updateClient } from "./clients.controller";

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

function req(body: unknown, params: Record<string, string> = {}) {
  return {
    body,
    params,
    path: "/v1/clients",
    user: { uid: "u1", tenantId: "t1", role: "MASTER" },
  } as unknown as Request;
}

const originalMode = process.env.TENANT_PLAN_CAPABILITY_MODE;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TENANT_PLAN_CAPABILITY_MODE = "enforce";
  mockHasCapability.mockResolvedValue(true);
  store = {
    price_tables: {
      vip: { tenantId: "t1", name: "VIP", adjustmentPercent: -10 },
      alheia: { tenantId: "outra", name: "Da outra", adjustmentPercent: 5 },
    },
    clients: {
      c1: { tenantId: "t1", name: "Ana", types: ["cliente"] },
      c2: { tenantId: "t1", name: "Bia", types: ["cliente"], priceTableId: "vip" },
    },
    users: { master: { tenantId: "t1" } },
  };
  mockDb = createFakeDb(store);
});

afterAll(() => {
  process.env.TENANT_PLAN_CAPABILITY_MODE = originalMode;
});

function createdClient() {
  const ids = Object.keys(store.clients).filter((id) => id !== "c1" && id !== "c2");
  return ids.length === 1 ? store.clients[ids[0]] : undefined;
}

describe("criar contato com tabela de preço", () => {
  it("grava a tabela da empresa no cliente", async () => {
    const res = fakeRes();
    await createClient(req({ name: "Carla", priceTableId: "vip" }), res);
    expect(res.statusCode).toBe(201);
    expect(createdClient()?.priceTableId).toBe("vip");
    expect(mockHasCapability).toHaveBeenCalledWith("t1", "priceTables");
  });

  it("sem tabela, o cliente fica na tabela padrão (campo ausente)", async () => {
    const res = fakeRes();
    await createClient(req({ name: "Carla", priceTableId: null }), res);
    expect(res.statusCode).toBe(201);
    expect(createdClient()).not.toHaveProperty("priceTableId");
  });

  it("recusa tabela de outra empresa ou inexistente", async () => {
    for (const id of ["alheia", "fantasma"]) {
      const res = fakeRes();
      await createClient(req({ name: "Carla", priceTableId: id }), res);
      expect(res.statusCode).toBe(400);
    }
    expect(createdClient()).toBeUndefined();
  });

  it("recusa tabela em contato que não é cliente", async () => {
    const res = fakeRes();
    await createClient(req({ name: "Fornecedor", types: ["fornecedor"], priceTableId: "vip" }), res);
    expect(res.statusCode).toBe(400);
    expect(String(res.body.message)).toContain("cliente");
  });

  it("plano sem o módulo leva 402", async () => {
    mockHasCapability.mockResolvedValue(false);
    const res = fakeRes();
    await createClient(req({ name: "Carla", priceTableId: "vip" }), res);
    expect(res.statusCode).toBe(402);
    expect(res.body.code).toBe("PLAN_CAPABILITY_REQUIRED");
    expect(createdClient()).toBeUndefined();
  });

  it("em modo monitor o gate não barra, como o das rotas", async () => {
    process.env.TENANT_PLAN_CAPABILITY_MODE = "monitor";
    mockHasCapability.mockResolvedValue(false);
    const res = fakeRes();
    await createClient(req({ name: "Carla", priceTableId: "vip" }), res);
    expect(res.statusCode).toBe(201);
  });
});

describe("editar a tabela do contato", () => {
  it("troca para uma tabela da empresa", async () => {
    const res = fakeRes();
    await updateClient(req({ priceTableId: "vip" }, { id: "c1" }), res);
    expect(res.statusCode).toBe(200);
    expect(store.clients.c1.priceTableId).toBe("vip");
  });

  it("recusa tabela de outra empresa e não mexe no cadastro", async () => {
    const res = fakeRes();
    await updateClient(req({ priceTableId: "alheia" }, { id: "c2" }), res);
    expect(res.statusCode).toBe(400);
    expect(store.clients.c2.priceTableId).toBe("vip");
  });

  it("null volta para a tabela padrão, mesmo sem o módulo no plano", async () => {
    mockHasCapability.mockResolvedValue(false);
    const res = fakeRes();
    await updateClient(req({ priceTableId: null }, { id: "c2" }), res);
    expect(res.statusCode).toBe(200);
    expect(store.clients.c2).not.toHaveProperty("priceTableId");
  });

  it("deixar de ser cliente apaga a tabela", async () => {
    const res = fakeRes();
    await updateClient(req({ types: ["fornecedor"] }, { id: "c2" }), res);
    expect(res.statusCode).toBe(200);
    expect(store.clients.c2).not.toHaveProperty("priceTableId");
  });

  it("mudar outro campo não toca na tabela", async () => {
    const res = fakeRes();
    await updateClient(req({ name: "Beatriz" }, { id: "c2" }), res);
    expect(res.statusCode).toBe(200);
    expect(store.clients.c2.priceTableId).toBe("vip");
  });

  it("plano sem o módulo não escolhe tabela nova (402)", async () => {
    mockHasCapability.mockResolvedValue(false);
    const res = fakeRes();
    await updateClient(req({ priceTableId: "vip" }, { id: "c1" }), res);
    expect(res.statusCode).toBe(402);
    expect(store.clients.c1).not.toHaveProperty("priceTableId");
  });
});
