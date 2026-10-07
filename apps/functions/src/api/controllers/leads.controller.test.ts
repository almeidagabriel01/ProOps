/**
 * Leads do CRM: permissão do CRM (pageId kanban), isolamento por empresa,
 * validação e a conversão em contato respeitando o teto de contatos do plano.
 */

import type { Request, Response } from "express";

const hasPagePermission = jest.fn();
const enforceTenantPlanLimit = jest.fn();
let leads: Record<string, Record<string, unknown>>;
let clients: Record<string, Record<string, unknown>>;
const added: Record<string, unknown>[] = [];
const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
const txSets: Array<{ id: string; data: Record<string, unknown> }> = [];
const txUpdates: Array<{ id: string; data: Record<string, unknown> }> = [];
const batchDeletes: string[] = [];

jest.mock("../../lib/auth-helpers", () => ({
  recordInScope: async () => true,
  getPageScope: async () => "all",
  hasPagePermission: (...a: unknown[]) => hasPagePermission(...a),
}));
jest.mock("../../lib/tenant-plan-policy", () => ({
  enforceTenantPlanLimit: (...a: unknown[]) => enforceTenantPlanLimit(...a),
  getTenantClientsUsage: jest.fn(async () => 0),
}));
jest.mock("../../lib/search-tokens", () => ({
  buildClientSearchTokens: () => ["tok"],
}));

jest.mock("../../init", () => {
  const leadRef = (id: string) => ({
    id,
    get: async () => ({ exists: !!leads[id], data: () => leads[id] }),
    update: async (data: Record<string, unknown>) => {
      updates.push({ id, data });
    },
  });
  return {
    db: {
      collection: (name: string) => {
        if (name === "leads") {
          const q = {
            where: () => q,
            limit: () => q,
            get: async () => ({
              docs: Object.entries(leads).map(([id, data]) => ({ id, data: () => data })),
            }),
            add: async (data: Record<string, unknown>) => {
              added.push(data);
              return { id: "novo" };
            },
            doc: leadRef,
          };
          return q;
        }
        if (name === "clients") {
          return {
            doc: (id?: string) => ({
              id: id ?? "cliente-novo",
              get: async () => ({ exists: !!(id && clients[id]), data: () => (id ? clients[id] : undefined) }),
            }),
          };
        }
        if (name === "companies") {
          return { doc: (id: string) => ({ id: `company:${id}` }) };
        }
        if (name === "users") {
          const team: Record<string, Record<string, unknown>> = {
            u1: { name: "Ana Vendas", tenantId: "t1" },
            u2: { name: "Bruno Vendas", tenantId: "t1" },
            x9: { name: "De fora", tenantId: "t2" },
          };
          return {
            doc: (id: string) => ({
              get: async () => ({ exists: !!team[id], data: () => team[id] ?? { name: "Ana Vendas" } }),
            }),
          };
        }
        if (name === "activities") {
          const q = {
            where: () => q,
            limit: () => q,
            get: async () => ({ docs: [{ ref: { id: "a1" } }] }),
          };
          return q;
        }
        throw new Error(`coleção inesperada: ${name}`);
      },
      batch: () => ({
        delete: (ref: { id: string }) => batchDeletes.push(ref.id),
        commit: async () => undefined,
      }),
      runTransaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          get: async () => ({ exists: false }),
          set: (ref: { id: string }, data: Record<string, unknown>) => txSets.push({ id: ref.id, data }),
          update: (ref: { id: string }, data: Record<string, unknown>) => txUpdates.push({ id: ref.id, data }),
        }),
    },
  };
});

import { convertLead, createLead, deleteLead, listLeads, updateLead } from "./leads.controller";

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

function fakeReq(params: Record<string, string> = {}, body: unknown = {}) {
  return {
    params,
    body,
    path: "/leads",
    user: { uid: "u1", tenantId: "t1", role: "MEMBER" },
  } as unknown as Request;
}

beforeEach(() => {
  jest.clearAllMocks();
  added.length = 0;
  updates.length = 0;
  txSets.length = 0;
  txUpdates.length = 0;
  batchDeletes.length = 0;
  hasPagePermission.mockResolvedValue(true);
  enforceTenantPlanLimit.mockResolvedValue({ allowed: true });
  leads = {
    l1: { tenantId: "t1", name: "Carla", phone: "11988880001", stage: "qualificado", createdAt: "2026-09-01" },
    l2: { tenantId: "t1", name: "Diego", stage: "novo", createdAt: "2026-09-10" },
    outro: { tenantId: "t2", name: "De outra empresa", stage: "novo" },
  };
  clients = {};
});

describe("listLeads", () => {
  it("usa a permissão de ver o CRM", async () => {
    hasPagePermission.mockResolvedValue(false);
    const res = fakeRes();
    await listLeads(fakeReq(), res);
    expect(res.statusCode).toBe(403);
    expect(hasPagePermission).toHaveBeenCalledWith(expect.anything(), "kanban", "canView");
  });

  it("ordena do mais novo para o mais antigo", async () => {
    delete leads.outro;
    const res = fakeRes();
    await listLeads(fakeReq(), res);
    const names = (res.body.leads as Array<{ name: string }>).map((l) => l.name);
    expect(names).toEqual(["Diego", "Carla"]);
  });
});

describe("createLead", () => {
  it("grava na empresa do usuário, com dono e etapa inicial", async () => {
    const res = fakeRes();
    await createLead(fakeReq({}, { name: "Nova Lead", source: "instagram", tenantId: "t2" }), res);
    // tenantId no corpo é recusado pelo schema estrito
    expect(res.statusCode).toBe(400);

    const ok = fakeRes();
    await createLead(fakeReq({}, { name: "Nova Lead", source: "instagram" }), ok);
    expect(ok.statusCode).toBe(201);
    expect(added[0]).toMatchObject({
      tenantId: "t1",
      ownerId: "u1",
      ownerName: "Ana Vendas",
      stage: "novo",
      source: "instagram",
    });
  });

  it("nega sem permissão de criar no CRM", async () => {
    hasPagePermission.mockResolvedValue(false);
    const res = fakeRes();
    await createLead(fakeReq({}, { name: "Nova Lead" }), res);
    expect(res.statusCode).toBe(403);
    expect(hasPagePermission).toHaveBeenCalledWith(expect.anything(), "kanban", "canCreate");
    expect(added).toHaveLength(0);
  });

  it("recusa e-mail inválido", async () => {
    const res = fakeRes();
    await createLead(fakeReq({}, { name: "Nova Lead", email: "nao-e-email" }), res);
    expect(res.statusCode).toBe(400);
  });
});

describe("updateLead", () => {
  it("lead de outra empresa é 404", async () => {
    const res = fakeRes();
    await updateLead(fakeReq({ id: "outro" }, { stage: "contato" }), res);
    expect(res.statusCode).toBe(404);
    expect(updates).toHaveLength(0);
  });

  it("move de etapa", async () => {
    const res = fakeRes();
    await updateLead(fakeReq({ id: "l2" }, { stage: "contato" }), res);
    expect(res.statusCode).toBe(200);
    expect(updates[0].data).toMatchObject({ stage: "contato" });
  });

  it("texto enviado vazio limpa o campo", async () => {
    const res = fakeRes();
    await updateLead(fakeReq({ id: "l1" }, { phone: "", nextActionAt: null }), res);
    expect(res.statusCode).toBe(200);
    expect(updates[0].data).toMatchObject({ phone: null, nextActionAt: null });
  });

  it("trocar o dono pede 'Trocar dono do lead' e uma pessoa da equipe", async () => {
    leads.l2.ownerId = "u1";
    hasPagePermission.mockImplementation(async (_c: unknown, _p: string, key: string) => key !== "reassignLead");
    const negado = fakeRes();
    await updateLead(fakeReq({ id: "l2" }, { ownerId: "u2" }), negado);
    expect(negado.statusCode).toBe(403);
    expect(updates).toHaveLength(0);

    // O formulário reenvia o dono de sempre: isso não é troca.
    const mesmo = fakeRes();
    await updateLead(fakeReq({ id: "l2" }, { ownerId: "u1", stage: "contato" }), mesmo);
    expect(mesmo.statusCode).toBe(200);

    hasPagePermission.mockResolvedValue(true);
    const fora = fakeRes();
    await updateLead(fakeReq({ id: "l2" }, { ownerId: "x9" }), fora);
    expect(fora.statusCode).toBe(400);

    const ok = fakeRes();
    await updateLead(fakeReq({ id: "l2" }, { ownerId: "u2" }), ok);
    expect(ok.statusCode).toBe(200);
    expect(updates.at(-1)?.data).toMatchObject({ ownerId: "u2", ownerName: "Bruno Vendas" });
  });

  it("não deixa marcar como convertido sem passar pela conversão", async () => {
    const res = fakeRes();
    await updateLead(fakeReq({ id: "l2" }, { stage: "convertido" }), res);
    expect(res.statusCode).toBe(400);
    expect(updates).toHaveLength(0);
  });
});

describe("deleteLead", () => {
  it("apaga o lead e as atividades dele", async () => {
    const res = fakeRes();
    await deleteLead(fakeReq({ id: "l1" }), res);
    expect(res.statusCode).toBe(200);
    expect(batchDeletes).toEqual(["a1", "l1"]);
  });

  it("exige a permissão de excluir", async () => {
    hasPagePermission.mockResolvedValue(false);
    const res = fakeRes();
    await deleteLead(fakeReq({ id: "l1" }), res);
    expect(res.statusCode).toBe(403);
    expect(hasPagePermission).toHaveBeenCalledWith(expect.anything(), "kanban", "canDelete");
  });
});

describe("convertLead", () => {
  it("cria o contato, marca o lead e devolve o id", async () => {
    const res = fakeRes();
    await convertLead(fakeReq({ id: "l1" }), res);
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ clientId: "cliente-novo", created: true });
    expect(txSets[0].data).toMatchObject({
      tenantId: "t1",
      name: "Carla",
      phone: "11988880001",
      source: "lead",
      sourceId: "l1",
      types: ["cliente"],
    });
    expect(txUpdates.find((u) => u.id === "l1")?.data).toMatchObject({
      clientId: "cliente-novo",
      stage: "convertido",
    });
  });

  it("quem cuidava do lead passa a ser o responsável do contato", async () => {
    leads.l1.ownerId = "ana";
    leads.l1.ownerName = "Ana";
    const res = fakeRes();
    await convertLead(fakeReq({ id: "l1" }), res);
    expect(txSets[0].data).toMatchObject({ responsibleMemberId: "ana", responsibleMemberName: "Ana" });
  });

  it("lead sem dono gera contato sem responsável", async () => {
    const res = fakeRes();
    await convertLead(fakeReq({ id: "l1" }), res);
    expect(txSets[0].data).not.toHaveProperty("responsibleMemberId");
    expect(txSets[0].data).not.toHaveProperty("responsibleMemberName");
  });

  it("respeita o teto de contatos do plano", async () => {
    enforceTenantPlanLimit.mockResolvedValue({
      allowed: false,
      statusCode: 402,
      code: "PLAN_LIMIT_EXCEEDED",
      message: "Limite de contatos atingido.",
    });
    const res = fakeRes();
    await convertLead(fakeReq({ id: "l1" }), res);
    expect(res.statusCode).toBe(402);
    expect(enforceTenantPlanLimit).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "t1", feature: "maxClients" }),
    );
    expect(txSets).toHaveLength(0);
  });

  it("reaproveita o contato já ligado ao lead, sem gastar o teto", async () => {
    leads.l1.clientId = "c9";
    clients.c9 = { tenantId: "t1", name: "Carla" };
    const res = fakeRes();
    await convertLead(fakeReq({ id: "l1" }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ clientId: "c9", created: false });
    expect(enforceTenantPlanLimit).not.toHaveBeenCalled();
    expect(updates[0].data).toMatchObject({ stage: "convertido" });
  });

  it("sem permissão de criar contato não cria", async () => {
    hasPagePermission.mockImplementation(async (_u: unknown, page: string) => page === "kanban");
    const res = fakeRes();
    await convertLead(fakeReq({ id: "l1" }), res);
    expect(res.statusCode).toBe(403);
    expect(txSets).toHaveLength(0);
  });

  it("lead de outra empresa é 404", async () => {
    const res = fakeRes();
    await convertLead(fakeReq({ id: "outro" }), res);
    expect(res.statusCode).toBe(404);
  });
});
