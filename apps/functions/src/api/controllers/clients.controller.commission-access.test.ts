/**
 * O contato parceiro (vendedor, arquiteto) guarda o percentual de comissão e,
 * se for da equipe, o membro ligado a ele (`linkedMemberId`). É esse vínculo
 * que faz "Minhas comissões" mostrar as comissões do contato para o membro.
 *
 * Qualquer membro com "Editar" em Contatos se ligava a um parceiro e passava
 * a ler as comissões dele, ou mudava o percentual que a empresa paga. Agora as
 * duas coisas são do dono e dos administradores, na criação e na mudança de
 * valor. O formulário reenvia os campos, então reenviar o mesmo valor passa.
 */

import type { Request, Response } from "express";
import {
  createFakeDb,
  type FakeStore,
} from "../services/price-tables/__tests__/fake-firestore";

let mockDb: ReturnType<typeof createFakeDb>;
let store: FakeStore;
let mockIsMaster = true;

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
  resolveUserAndTenant: async () => ({
    userData: { tenantId: "t1" },
    masterData: { tenantId: "t1" },
    masterRef: mockDb.collection("users").doc("master"),
    isMaster: mockIsMaster,
    isSuperAdmin: false,
    tenantId: "t1",
  }),
  checkPermission: async () => true,
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
  mockIsMaster = true;
  store = {
    clients: {
      arq: { tenantId: "t1", name: "Ana Arquiteta", types: ["arquiteto"], commissionPercentage: 5 },
      ven: { tenantId: "t1", name: "Bruno", types: ["vendedor"], commissionPercentage: 3, linkedMemberId: "m2" },
    },
    users: { master: { tenantId: "t1" } },
  };
  mockDb = createFakeDb(store);
});

describe("membro não define comissão nem vínculo com a equipe", () => {
  beforeEach(() => {
    mockIsMaster = false;
  });

  it("não se liga a um parceiro para ler as comissões dele", async () => {
    const res = fakeRes();
    await updateClient(req({ linkedMemberId: "u1" }, { id: "arq" }), res);
    expect(res.statusCode).toBe(403);
    expect(store.clients.arq).not.toHaveProperty("linkedMemberId");
  });

  it("não troca o membro ligado nem tira o vínculo", async () => {
    const troca = fakeRes();
    await updateClient(req({ linkedMemberId: "u1" }, { id: "ven" }), troca);
    expect(troca.statusCode).toBe(403);

    const tira = fakeRes();
    await updateClient(req({ linkedMemberId: null }, { id: "ven" }), tira);
    expect(tira.statusCode).toBe(403);
    expect(store.clients.ven.linkedMemberId).toBe("m2");
  });

  it("não muda o percentual de comissão", async () => {
    const res = fakeRes();
    await updateClient(req({ commissionPercentage: 40 }, { id: "arq" }), res);
    expect(res.statusCode).toBe(403);
    expect(store.clients.arq.commissionPercentage).toBe(5);
  });

  it("o formulário reenviando os mesmos valores segue editando o resto", async () => {
    const res = fakeRes();
    await updateClient(
      req({ name: "Bruno Lima", commissionPercentage: 3, linkedMemberId: "m2" }, { id: "ven" }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(store.clients.ven.name).toBe("Bruno Lima");
  });

  it("não cria parceiro já ligado a alguém nem com percentual", async () => {
    const ligado = fakeRes();
    await createClient(req({ name: "Carla", types: ["vendedor"], linkedMemberId: "u1" }), ligado);
    expect(ligado.statusCode).toBe(403);

    const percentual = fakeRes();
    await createClient(req({ name: "Carla", types: ["arquiteto"], commissionPercentage: 10 }), percentual);
    expect(percentual.statusCode).toBe(403);
  });

  it("cria o parceiro sem comissão nem vínculo", async () => {
    const res = fakeRes();
    await createClient(req({ name: "Carla", types: ["arquiteto"], commissionPercentage: null }), res);
    expect(res.statusCode).toBe(201);
  });
});

describe("dono e administradores definem", () => {
  it("dono liga o contato a um membro e muda o percentual", async () => {
    const res = fakeRes();
    await updateClient(req({ linkedMemberId: "u1", commissionPercentage: 7 }, { id: "arq" }), res);
    expect(res.statusCode).toBe(200);
    expect(store.clients.arq).toMatchObject({ linkedMemberId: "u1", commissionPercentage: 7 });
  });

  it("dono cria o parceiro com percentual e vínculo", async () => {
    const res = fakeRes();
    await createClient(
      req({ name: "Carla", types: ["vendedor"], commissionPercentage: 4, linkedMemberId: "u1" }),
      res,
    );
    expect(res.statusCode).toBe(201);
  });
});
