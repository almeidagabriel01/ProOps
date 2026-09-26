/**
 * Metas de vendas: o dono define e vê a equipe; o membro vê só o próprio
 * número (nem a meta nem o vendido dos outros chegam na resposta).
 */

let users: Array<{ id: string; data: Record<string, unknown> }>;
let goalsDoc: Record<string, unknown> | undefined;
let approved: Array<Record<string, unknown>>;
const sets: Array<{ id: string; data: Record<string, unknown> }> = [];
const proposalFilters: unknown[][] = [];

jest.mock("../../init", () => ({
  db: {
    collection: (name: string) => {
      if (name === "users") {
        return {
          where: (_f: string, _o: string, tenantId: string) => ({
            limit: () => ({
              get: async () => ({
                docs: users.filter((u) => u.data.tenantId === tenantId).map((u) => ({ id: u.id, data: () => u.data })),
              }),
            }),
          }),
        };
      }
      if (name === "sales_goals") {
        return {
          doc: (id: string) => ({
            get: async () => ({ data: () => goalsDoc }),
            set: async (data: Record<string, unknown>) => {
              sets.push({ id, data });
            },
          }),
        };
      }
      // proposals
      const q = {
        where: (...args: unknown[]) => {
          proposalFilters.push(args);
          return q;
        },
        orderBy: () => q,
        limit: () => q,
        get: async () => ({ docs: approved.map((p) => ({ data: () => p })) }),
      };
      return q;
    },
  },
}));

import type { Request, Response } from "express";
import {
  getSalesGoals,
  getSalesGoalsProgress,
  updateSalesGoals,
} from "./sales-goals.controller";

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

function req(role: string, uid: string, extra: Partial<Request> = {}): Request {
  return { query: {}, body: {}, user: { uid, role, tenantId: "t1" }, ...extra } as unknown as Request;
}

beforeEach(() => {
  users = [
    { id: "dono", data: { tenantId: "t1", role: "MASTER", name: "Dona" } },
    { id: "ana", data: { tenantId: "t1", role: "MEMBER", name: "Ana" } },
    { id: "beto", data: { tenantId: "t1", role: "MEMBER", name: "Beto" } },
    { id: "outra", data: { tenantId: "t2", role: "MASTER", name: "Outra" } },
  ];
  goalsDoc = { companyTarget: 50000, targets: { ana: 20000, beto: 15000 } };
  approved = [
    { sellerId: "ana", totalValue: 12000 },
    { sellerId: "beto", totalValue: 7000 },
  ];
  sets.length = 0;
  proposalFilters.length = 0;
});

describe("progresso", () => {
  it("o dono vê a empresa e a equipe, pelo mês da aprovação", async () => {
    const r = res();
    await getSalesGoalsProgress(req("MASTER", "dono", { query: { month: "2026-09" } }), r);
    expect(r.body).toMatchObject({ scope: "company", companyTarget: 50000, companyAchieved: 19000 });
    expect((r.body.people as unknown[]).length).toBe(2);
    expect(proposalFilters).toEqual([
      ["tenantId", "==", "t1"],
      ["approvedAt", ">=", "2026-09-01T03:00:00.000Z"],
      ["approvedAt", "<", "2026-10-01T03:00:00.000Z"],
    ]);
  });

  it("o membro recebe só o próprio número, sem a equipe nem a meta da empresa", async () => {
    const r = res();
    await getSalesGoalsProgress(req("MEMBER", "ana", { query: { month: "2026-09" } }), r);
    expect(r.body).toEqual({ month: "2026-09", scope: "mine", target: 20000, achieved: 12000, count: 1 });
  });

  it("membro sem meta e sem venda recebe zero", async () => {
    users.push({ id: "carla", data: { tenantId: "t1", role: "MEMBER", name: "Carla" } });
    const r = res();
    await getSalesGoalsProgress(req("MEMBER", "carla", { query: { month: "2026-09" } }), r);
    expect(r.body).toMatchObject({ target: null, achieved: 0, count: 0 });
  });

  it("mês inválido leva 400", async () => {
    const r = res();
    await getSalesGoalsProgress(req("MASTER", "dono", { query: { month: "09/2026" } }), r);
    expect(r.statusCode).toBe(400);
  });
});

describe("definir metas", () => {
  it("membro não lê nem grava a configuração", async () => {
    const leitura = res();
    await getSalesGoals(req("MEMBER", "ana", { query: { month: "2026-09" } }), leitura);
    expect(leitura.statusCode).toBe(403);

    const escrita = res();
    await updateSalesGoals(
      req("MEMBER", "ana", { body: { month: "2026-09", companyTarget: 1, targets: {} } }),
      escrita,
    );
    expect(escrita.statusCode).toBe(403);
    expect(sets).toEqual([]);
  });

  it("o dono grava; meta zero é 'sem meta' e não fica guardada", async () => {
    const r = res();
    await updateSalesGoals(
      req("MASTER", "dono", {
        body: { month: "2026-10", companyTarget: 60000, targets: { ana: 25000, beto: 0 } },
      }),
      r,
    );
    expect(r.statusCode).toBe(200);
    expect(sets[0]).toMatchObject({
      id: "t1_2026-10",
      data: { tenantId: "t1", month: "2026-10", companyTarget: 60000, targets: { ana: 25000 } },
    });
  });

  it("meta para quem não é da empresa é recusada", async () => {
    const r = res();
    await updateSalesGoals(
      req("MASTER", "dono", { body: { month: "2026-10", companyTarget: null, targets: { outra: 1000 } } }),
      r,
    );
    expect(r.statusCode).toBe(400);
    expect(sets).toEqual([]);
  });

  it("valor negativo é recusado", async () => {
    const r = res();
    await updateSalesGoals(
      req("MASTER", "dono", { body: { month: "2026-10", companyTarget: -5, targets: {} } }),
      r,
    );
    expect(r.statusCode).toBe(400);
  });
});
