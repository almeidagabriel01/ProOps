/**
 * Ações finas de Contatos: trocar quem cuida do contato (e os parceiros) e a
 * tabela de preço. Vale o valor que muda: o formulário reenvia o contato
 * inteiro. As chaves ausentes valem o "Editar", então nada muda no dia.
 */

import type { Request, Response } from "express";
import {
  createFakeDb,
  type FakeStore,
} from "../services/price-tables/__tests__/fake-firestore";

let mockDb: ReturnType<typeof createFakeDb>;
let store: FakeStore;
let mockIsMaster = true;
const mockDenied = new Set<string>();

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
    isMaster: mockIsMaster,
    isSuperAdmin: false,
    tenantId: "t1",
  }),
  checkPermission: async (_uid: string, pageId: string, key: string) =>
    !mockDenied.has(`${pageId}.${key}`),
}));
jest.mock("../services/contact-member-link", () => ({
  validateMemberLink: async () => undefined,
  memberLinkErrorMessage: () => null,
}));
jest.mock("../../lib/tenant-plan-policy", () => ({
  enforceTenantPlanLimit: async () => ({ allowed: true }),
  getTenantClientsUsage: async () => 0,
}));
jest.mock("../../lib/tenant-resolution", () => ({
  assertTenantExists: async () => undefined,
  auditSuperAdminCrossTenantWrite: () => undefined,
}));
jest.mock("../../lib/tenant-capabilities", () => ({ tenantHasCapability: async () => true }));
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
    user: { uid: "u1", tenantId: "t1", role: mockIsMaster ? "MASTER" : "MEMBER" },
  } as unknown as Request;
}

beforeEach(() => {
  mockIsMaster = false;
  mockDenied.clear();
  store = {
    clients: {
      arq: { tenantId: "t1", name: "Ana Arquiteta", types: ["arquiteto"], commissionPercentage: 5 },
      ven: { tenantId: "t1", name: "Bruno", types: ["vendedor"], commissionPercentage: 3, linkedMemberId: "m2" },
    },
    users: {
      master: { tenantId: "t1" },
      u1: { tenantId: "t1", name: "Vendedora", role: "MEMBER" },
      u2: { tenantId: "t1", name: "Outro", role: "MEMBER" },
    },
  };
  mockDb = createFakeDb(store);
});

describe("ações finas de Contatos", () => {
  beforeEach(() => {
    store.clients.cli = {
      tenantId: "t1",
      name: "Cliente",
      types: ["cliente"],
      responsibleMemberId: "u1",
      responsibleMemberName: "Vendedora",
      priceTableId: "tab1",
    };
    store.price_tables = { tab1: { tenantId: "t1", name: "Atacado", adjustmentPercent: -5 } };
  });

  it("sem 'Trocar o responsável', não muda quem cuida do contato nem os parceiros", async () => {
    mockDenied.add("clients.reassign");
    const outro = fakeRes();
    await updateClient(req({ responsibleMemberId: "u2" }, { id: "cli" }), outro);
    expect(outro.statusCode).toBe(403);
    expect(store.clients.cli.responsibleMemberId).toBe("u1");

    const parceiros = fakeRes();
    await updateClient(req({ partnerContactIds: ["arq"] }, { id: "cli" }), parceiros);
    expect(parceiros.statusCode).toBe(403);
  });

  it("reenviar o mesmo responsável e a mesma tabela segue editando o resto", async () => {
    mockDenied.add("clients.reassign");
    mockDenied.add("clients.priceTable");
    const res = fakeRes();
    await updateClient(
      req({ name: "Cliente Novo", responsibleMemberId: "u1", priceTableId: "tab1" }, { id: "cli" }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(store.clients.cli.name).toBe("Cliente Novo");
  });

  it("sem 'Tabela de preço', não troca nem tira a tabela", async () => {
    mockDenied.add("clients.priceTable");
    const tirar = fakeRes();
    await updateClient(req({ priceTableId: null }, { id: "cli" }), tirar);
    expect(tirar.statusCode).toBe(403);
    expect(store.clients.cli.priceTableId).toBe("tab1");
  });

  it("na criação, pôr outra pessoa como responsável ou escolher tabela pede as chaves", async () => {
    mockDenied.add("clients.reassign");
    mockDenied.add("clients.priceTable");
    const outro = fakeRes();
    await createClient(req({ name: "Novo", types: ["cliente"], responsibleMemberId: "u2" }), outro);
    expect(outro.statusCode).toBe(403);

    const tabela = fakeRes();
    await createClient(req({ name: "Novo", types: ["cliente"], priceTableId: "tab1" }), tabela);
    expect(tabela.statusCode).toBe(403);

    const proprio = fakeRes();
    await createClient(req({ name: "Novo", types: ["cliente"], responsibleMemberId: "u1" }), proprio);
    expect(proprio.statusCode).toBe(201);
  });

  it("contato que o membro cria nasce com ele como responsável", async () => {
    const res = fakeRes();
    await createClient(req({ name: "Novo cliente", types: ["cliente"] }), res);
    expect(res.statusCode).toBe(201);
    const created = Object.values(store.clients).find((c) => c.name === "Novo cliente");
    expect(created).toMatchObject({ responsibleMemberId: "u1", responsibleMemberName: "Vendedora" });

    const fornecedor = fakeRes();
    await createClient(req({ name: "Fornecedor X", types: ["fornecedor"] }), fornecedor);
    const supplier = Object.values(store.clients).find((c) => c.name === "Fornecedor X");
    expect(supplier?.responsibleMemberId).toBeUndefined();
  });

  it("dono não depende das chaves", async () => {
    mockIsMaster = true;
    mockDenied.add("clients.reassign");
    const res = fakeRes();
    await updateClient(req({ responsibleMemberId: "u2" }, { id: "cli" }), res);
    expect(res.statusCode).toBe(200);
    expect(store.clients.cli.responsibleMemberId).toBe("u2");
  });
});
