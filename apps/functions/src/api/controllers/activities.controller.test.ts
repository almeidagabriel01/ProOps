/**
 * Atividades do CRM: presas a lead ou contato DA MESMA empresa, permissão do
 * CRM, e concluir grava a data.
 */

import type { Request, Response } from "express";

const hasPagePermission = jest.fn();
let docs: Record<string, Record<string, Record<string, unknown>>>;
const added: Record<string, unknown>[] = [];
const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
const deleted: string[] = [];

jest.mock("../../lib/auth-helpers", () => ({
  hasPagePermission: (...a: unknown[]) => hasPagePermission(...a),
}));

jest.mock("../../init", () => ({
  db: {
    collection: (name: string) => {
      const col = docs[name] ?? {};
      const q = {
        where: () => q,
        limit: () => q,
        get: async () => ({
          docs: Object.entries(col).map(([id, data]) => ({ id, data: () => data })),
        }),
        add: async (data: Record<string, unknown>) => {
          added.push(data);
          return { id: "nova" };
        },
        doc: (id: string) => ({
          get: async () => ({
            exists: !!col[id],
            data: () => (name === "users" ? { name: "Ana" } : col[id]),
          }),
          update: async (data: Record<string, unknown>) => {
            updates.push({ id, data });
          },
          delete: async () => {
            deleted.push(id);
          },
        }),
      };
      return q;
    },
  },
}));

import {
  createActivity,
  deleteActivity,
  listActivities,
  updateActivity,
} from "./activities.controller";

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

function fakeReq(opts: { params?: Record<string, string>; body?: unknown; query?: Record<string, string> } = {}) {
  return {
    params: opts.params ?? {},
    body: opts.body ?? {},
    query: opts.query ?? {},
    user: { uid: "u1", tenantId: "t1", role: "MEMBER" },
  } as unknown as Request;
}

beforeEach(() => {
  jest.clearAllMocks();
  added.length = 0;
  updates.length = 0;
  deleted.length = 0;
  hasPagePermission.mockResolvedValue(true);
  docs = {
    leads: { l1: { tenantId: "t1" }, l2: { tenantId: "t2" } },
    clients: { c1: { tenantId: "t1" } },
    users: { u1: {} },
    activities: {
      a1: { tenantId: "t1", leadId: "l1", type: "ligacao", title: "Ligar", createdAt: "2026-09-01" },
      a2: { tenantId: "t1", leadId: "l1", type: "visita", title: "Visitar", createdAt: "2026-09-05" },
      x: { tenantId: "t2", leadId: "l2", type: "nota", title: "De outra empresa" },
    },
  };
});

describe("listActivities", () => {
  it("exige lead ou contato", async () => {
    const res = fakeRes();
    await listActivities(fakeReq(), res);
    expect(res.statusCode).toBe(400);
  });

  it("lista da mais nova para a mais antiga", async () => {
    delete docs.activities.x;
    const res = fakeRes();
    await listActivities(fakeReq({ query: { leadId: "l1" } }), res);
    const titles = (res.body.activities as Array<{ title: string }>).map((a) => a.title);
    expect(titles).toEqual(["Visitar", "Ligar"]);
  });

  it("sem permissão de ver o CRM é 403", async () => {
    hasPagePermission.mockResolvedValue(false);
    const res = fakeRes();
    await listActivities(fakeReq({ query: { leadId: "l1" } }), res);
    expect(res.statusCode).toBe(403);
    expect(hasPagePermission).toHaveBeenCalledWith(expect.anything(), "kanban", "canView");
  });
});

describe("createActivity", () => {
  it("grava presa ao lead da empresa", async () => {
    const res = fakeRes();
    await createActivity(
      fakeReq({ body: { leadId: "l1", type: "ligacao", title: "Retornar", dueAt: "2026-09-30" } }),
      res,
    );
    expect(res.statusCode).toBe(201);
    expect(added[0]).toMatchObject({
      tenantId: "t1",
      leadId: "l1",
      clientId: null,
      type: "ligacao",
      dueAt: "2026-09-30",
      doneAt: null,
      createdBy: "u1",
    });
  });

  it("lead de outra empresa é 404", async () => {
    const res = fakeRes();
    await createActivity(fakeReq({ body: { leadId: "l2", type: "nota", title: "x" } }), res);
    expect(res.statusCode).toBe(404);
    expect(added).toHaveLength(0);
  });

  it("aceita contato no lugar do lead", async () => {
    const res = fakeRes();
    await createActivity(fakeReq({ body: { clientId: "c1", type: "visita", title: "Medição" } }), res);
    expect(res.statusCode).toBe(201);
  });

  it("sem lead e sem contato é 400", async () => {
    const res = fakeRes();
    await createActivity(fakeReq({ body: { type: "nota", title: "solta" } }), res);
    expect(res.statusCode).toBe(400);
  });

  it("quem só vê o CRM não registra", async () => {
    hasPagePermission.mockResolvedValue(false);
    const res = fakeRes();
    await createActivity(fakeReq({ body: { leadId: "l1", type: "nota", title: "x" } }), res);
    expect(res.statusCode).toBe(403);
  });
});

describe("updateActivity / deleteActivity", () => {
  it("concluir grava a data, reabrir limpa", async () => {
    const res = fakeRes();
    await updateActivity(fakeReq({ params: { id: "a1" }, body: { done: true } }), res);
    expect(typeof updates[0].data.doneAt).toBe("string");

    const again = fakeRes();
    await updateActivity(fakeReq({ params: { id: "a1" }, body: { done: false } }), again);
    expect(updates[1].data.doneAt).toBeNull();
  });

  it("atividade de outra empresa é 404 nos dois", async () => {
    const res = fakeRes();
    await updateActivity(fakeReq({ params: { id: "x" }, body: { done: true } }), res);
    expect(res.statusCode).toBe(404);

    const del = fakeRes();
    await deleteActivity(fakeReq({ params: { id: "x" } }), del);
    expect(del.statusCode).toBe(404);
    expect(deleted).toHaveLength(0);
  });

  it("exclui a da empresa", async () => {
    const res = fakeRes();
    await deleteActivity(fakeReq({ params: { id: "a1" } }), res);
    expect(deleted).toEqual(["a1"]);
  });

  it("quem só edita o CRM não apaga a atividade de outro vendedor", async () => {
    hasPagePermission.mockImplementation(async (_c: unknown, _p: string, action: string) => action !== "canDelete");
    docs.activities.a1.createdBy = "outro";
    const res = fakeRes();
    await deleteActivity(fakeReq({ params: { id: "a1" } }), res);
    expect(res.statusCode).toBe(403);
    expect(deleted).toHaveLength(0);
  });

  it("quem só edita o CRM apaga a atividade que registrou", async () => {
    hasPagePermission.mockImplementation(async (_c: unknown, _p: string, action: string) => action !== "canDelete");
    docs.activities.a1.createdBy = "u1";
    const res = fakeRes();
    await deleteActivity(fakeReq({ params: { id: "a1" } }), res);
    expect(deleted).toEqual(["a1"]);
  });

  it("com 'Excluir' no CRM apaga a de qualquer um", async () => {
    docs.activities.a1.createdBy = "outro";
    const res = fakeRes();
    await deleteActivity(fakeReq({ params: { id: "a1" } }), res);
    expect(deleted).toEqual(["a1"]);
  });
});
