/**
 * Tarefas: permissão de membro, quem enxerga (404 para quem não está na
 * tarefa), quem pode ser responsável e quem é avisado.
 */

type Doc = Record<string, unknown>;
const store: Record<string, Map<string, Doc>> = {};
const permissions = new Map<string, Doc>();
let autoId = 0;

function coll(name: string) {
  if (!store[name]) store[name] = new Map();
  return store[name];
}

jest.mock("../../init", () => ({
  db: {
    collection: (name: string) => ({
      doc: (id?: string) => {
        const docId = id ?? `novo-${++autoId}`;
        return {
          id: docId,
          get: async () => ({ exists: coll(name).has(docId), data: () => coll(name).get(docId) }),
          set: async (data: Doc) => {
            coll(name).set(docId, data);
          },
          update: async (data: Doc) => {
            coll(name).set(docId, { ...coll(name).get(docId), ...data });
          },
          delete: async () => {
            coll(name).delete(docId);
          },
        };
      },
      where: (_field: string, _op: string, tenantId: string) => ({
        limit: () => ({
          get: async () => ({
            docs: [...coll(name).entries()]
              .filter(([, d]) => d.tenantId === tenantId)
              .map(([id, d]) => ({
                id,
                data: () => d,
                ref: {
                  collection: () => ({
                    doc: (page: string) => ({
                      get: async () => ({ data: () => permissions.get(`${id}/${page}`) }),
                    }),
                  }),
                },
              })),
          }),
        }),
      }),
    }),
  },
}));

const hasPagePermission = jest.fn();
jest.mock("../../lib/auth-helpers", () => ({
  hasPagePermission: (...a: unknown[]) => hasPagePermission(...a),
}));

const createNotification = jest.fn();
jest.mock("../services/notification.service", () => ({
  NotificationService: { createNotification: (...a: unknown[]) => createNotification(...a) },
}));

import type { Request, Response } from "express";
import { createTask, deleteTask, listTaskPeople, updateTask } from "./tasks.controller";

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

function req(user: { uid: string; role: string }, body?: unknown, id?: string): Request {
  return { body, params: { id }, user: { ...user, tenantId: "t1" } } as unknown as Request;
}

const dono = { uid: "dono", role: "MASTER" };
const ana = { uid: "ana", role: "MEMBER" };
const beto = { uid: "beto", role: "MEMBER" };

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
  permissions.clear();
  jest.clearAllMocks();
  hasPagePermission.mockResolvedValue(true);
  createNotification.mockResolvedValue({});
  coll("users").set("dono", { tenantId: "t1", role: "MASTER", name: "Dona" });
  coll("users").set("ana", { tenantId: "t1", role: "MEMBER", name: "Ana" });
  coll("users").set("beto", { tenantId: "t1", role: "MEMBER", name: "Beto" });
  coll("users").set("sem-tela", { tenantId: "t1", role: "MEMBER", name: "Sem Tela" });
  coll("users").set("outra", { tenantId: "t2", role: "MASTER", name: "Outra" });
  permissions.set("ana/tasks", { canView: true });
  permissions.set("beto/tasks", { canView: true });
  coll("clients").set("c1", { tenantId: "t1", name: "Cliente Um" });
  coll("clients").set("c2", { tenantId: "t2", name: "De outra empresa" });
});

describe("quem pode ser responsável", () => {
  it("dono e membros que abrem Tarefas; nem quem não tem a tela, nem outra empresa", async () => {
    const r = res();
    await listTaskPeople(req(ana), r);
    expect((r.body.people as Array<{ id: string }>).map((p) => p.id)).toEqual(["ana", "beto", "dono"]);
  });
});

describe("criar", () => {
  it("membro sem permissão de criar leva 403", async () => {
    hasPagePermission.mockResolvedValue(false);
    const r = res();
    await createTask(req(ana, { title: "Ligar" }), r);
    expect(r.statusCode).toBe(403);
    expect(coll("tasks").size).toBe(0);
  });

  it("responsável que não abre Tarefas é recusado", async () => {
    const r = res();
    await createTask(req(ana, { title: "Ligar", assigneeId: "sem-tela" }), r);
    expect(r.statusCode).toBe(400);
  });

  it("responsável de outra empresa é recusado", async () => {
    const r = res();
    await createTask(req(ana, { title: "Ligar", assigneeId: "outra" }), r);
    expect(r.statusCode).toBe(400);
  });

  it("contato de outra empresa é recusado", async () => {
    const r = res();
    await createTask(req(ana, { title: "Ligar", clientId: "c2" }), r);
    expect(r.statusCode).toBe(404);
  });

  it("grava quem enxerga e avisa o responsável e os citados, nunca quem criou", async () => {
    const r = res();
    await createTask(
      req(ana, {
        title: "Medir a sala",
        assigneeId: "beto",
        mentionUids: ["dono", "ana", "beto"],
        clientId: "c1",
        dueAt: "2026-09-30",
      }),
      r,
    );
    expect(r.statusCode).toBe(201);
    const [task] = [...coll("tasks").values()];
    expect(task).toMatchObject({
      tenantId: "t1",
      assigneeId: "beto",
      assigneeName: "Beto",
      clientName: "Cliente Um",
      createdBy: "ana",
      audienceUids: ["ana", "beto", "dono"],
    });
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "task_assigned", targetUids: ["beto"], tenantId: "t1" }),
    );
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "task_mentioned", targetUids: ["dono"] }),
    );
  });
});

describe("enxergar e editar", () => {
  beforeEach(() => {
    coll("tasks").set("k1", {
      tenantId: "t1",
      title: "Da Ana",
      createdBy: "ana",
      assigneeId: null,
      mentionUids: [],
      audienceUids: ["ana"],
    });
  });

  it("membro que não está na tarefa leva 404, não 403", async () => {
    const r = res();
    await updateTask(req(beto, { title: "Invadida" }, "k1"), r);
    expect(r.statusCode).toBe(404);
    expect(coll("tasks").get("k1")?.title).toBe("Da Ana");
  });

  it("o dono edita qualquer tarefa", async () => {
    const r = res();
    await updateTask(req(dono, { title: "Revisada" }, "k1"), r);
    expect(r.statusCode).toBe(200);
    expect(coll("tasks").get("k1")?.title).toBe("Revisada");
  });

  it("concluir grava quando e quem; reabrir limpa", async () => {
    await updateTask(req(ana, { done: true }, "k1"), res());
    expect(coll("tasks").get("k1")).toMatchObject({ doneBy: "ana" });
    expect(coll("tasks").get("k1")?.doneAt).toEqual(expect.any(String));
    await updateTask(req(ana, { done: false }, "k1"), res());
    expect(coll("tasks").get("k1")).toMatchObject({ doneAt: null, doneBy: null });
  });

  it("passar para outra pessoa inclui ela em quem enxerga e a avisa", async () => {
    await updateTask(req(ana, { assigneeId: "beto" }, "k1"), res());
    expect(coll("tasks").get("k1")?.audienceUids).toEqual(["ana", "beto"]);
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "task_assigned", targetUids: ["beto"] }),
    );
  });

  it("concluir não avisa ninguém", async () => {
    await updateTask(req(ana, { done: true }, "k1"), res());
    expect(createNotification).not.toHaveBeenCalled();
  });
});

describe("prazo editado depois de atribuir (caso relatado)", () => {
  it("o aviso de atribuição não leva o prazo, e a mudança chega como aviso novo com a data nova", async () => {
    const created = res();
    await createTask(req(dono, { title: "Instalar", assigneeId: "beto", dueAt: "2026-09-25" }), created);
    const taskId = (created.body.task as { id: string }).id;

    const atribuicao = createNotification.mock.calls.find((c) => c[0].type === "task_assigned")?.[0];
    expect(atribuicao.message).not.toContain("25/09");

    createNotification.mockClear();
    await updateTask(
      req(dono, { title: "Instalar", dueAt: "2026-09-30", assigneeId: "beto", mentionUids: [] }, taskId),
      res(),
    );

    expect(createNotification).toHaveBeenCalledTimes(1);
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "task_updated",
        targetUids: ["beto"],
        taskId,
        message: expect.stringContaining("30/09"),
      }),
    );
  });

  it("o responsável que muda o próprio prazo não gera aviso", async () => {
    const created = res();
    await createTask(req(beto, { title: "Medir", assigneeId: "beto", dueAt: "2026-09-25" }), created);
    const taskId = (created.body.task as { id: string }).id;
    createNotification.mockClear();
    await updateTask(req(beto, { dueAt: "2026-09-28" }, taskId), res());
    expect(createNotification).not.toHaveBeenCalled();
  });
});

describe("excluir", () => {
  beforeEach(() => {
    coll("tasks").set("k1", {
      tenantId: "t1",
      title: "Da Ana",
      createdBy: "ana",
      assigneeId: "beto",
      audienceUids: ["ana", "beto"],
    });
  });

  it("o responsável que não criou não exclui", async () => {
    const r = res();
    await deleteTask(req(beto, undefined, "k1"), r);
    expect(r.statusCode).toBe(403);
    expect(coll("tasks").has("k1")).toBe(true);
  });

  it("quem criou exclui", async () => {
    await deleteTask(req(ana, undefined, "k1"), res());
    expect(coll("tasks").has("k1")).toBe(false);
  });

  it("o dono exclui", async () => {
    await deleteTask(req(dono, undefined, "k1"), res());
    expect(coll("tasks").has("k1")).toBe(false);
  });
});
