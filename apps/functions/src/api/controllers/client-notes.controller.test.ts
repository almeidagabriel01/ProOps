/**
 * Anotações da ficha do contato: permissão de contatos, isolamento por
 * empresa e validação do texto.
 */

import type { Request, Response } from "express";

const hasPagePermission = jest.fn();
let clients: Record<string, Record<string, unknown>>;
let notes: Record<string, Record<string, unknown>>;
const added: Record<string, unknown>[] = [];
const deleted: string[] = [];

jest.mock("../../lib/auth-helpers", () => ({
  hasPagePermission: (...a: unknown[]) => hasPagePermission(...a),
}));

jest.mock("../../init", () => ({
  db: {
    collection: (name: string) => {
      if (name === "clients") {
        return { doc: (id: string) => ({ get: async () => ({ exists: !!clients[id], data: () => clients[id] }) }) };
      }
      if (name === "users") {
        return { doc: () => ({ get: async () => ({ data: () => ({ name: "Ana Vendas" }) }) }) };
      }
      if (name === "client_notes") {
        const q = {
          where: () => q,
          orderBy: () => q,
          limit: () => q,
          get: async () => ({
            docs: Object.entries(notes).map(([id, data]) => ({ id, data: () => data })),
          }),
          add: async (data: Record<string, unknown>) => {
            added.push(data);
            return { id: "nova" };
          },
          doc: (id: string) => ({
            get: async () => ({ exists: !!notes[id], data: () => notes[id] }),
            delete: async () => {
              deleted.push(id);
            },
          }),
        };
        return q;
      }
      throw new Error(`coleção inesperada: ${name}`);
    },
  },
}));

import {
  createClientNote,
  deleteClientNote,
  listClientNotes,
} from "./client-notes.controller";

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

function fakeReq(params: Record<string, string>, body: unknown = {}) {
  return {
    params,
    body,
    user: { uid: "u1", tenantId: "t1", role: "MEMBER" },
  } as unknown as Request;
}

beforeEach(() => {
  jest.clearAllMocks();
  added.length = 0;
  deleted.length = 0;
  hasPagePermission.mockResolvedValue(true);
  clients = { c1: { tenantId: "t1" }, c2: { tenantId: "outra" } };
  notes = {
    n1: { tenantId: "t1", clientId: "c1", text: "Ligou", authorId: "u1", createdAt: "2026-09-25" },
  };
});

describe("client notes", () => {
  it("lista as anotações do contato", async () => {
    const res = fakeRes();
    await listClientNotes(fakeReq({ id: "c1" }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.notes).toEqual([
      expect.objectContaining({ id: "n1", text: "Ligou" }),
    ]);
    expect(hasPagePermission).toHaveBeenCalledWith(expect.anything(), "clients", "canView");
  });

  it("contato de outra empresa responde 404", async () => {
    const res = fakeRes();
    await listClientNotes(fakeReq({ id: "c2" }), res);
    expect(res.statusCode).toBe(404);
  });

  it("sem permissão de ver contatos responde 403", async () => {
    hasPagePermission.mockResolvedValue(false);
    const res = fakeRes();
    await listClientNotes(fakeReq({ id: "c1" }), res);
    expect(res.statusCode).toBe(403);
  });

  it("cria a anotação com autor e empresa do token", async () => {
    const res = fakeRes();
    await createClientNote(fakeReq({ id: "c1" }, { text: "  Pediu desconto  " }), res);
    expect(res.statusCode).toBe(201);
    expect(added[0]).toMatchObject({
      tenantId: "t1",
      clientId: "c1",
      text: "Pediu desconto",
      authorId: "u1",
      authorName: "Ana Vendas",
    });
    expect(hasPagePermission).toHaveBeenCalledWith(expect.anything(), "clients", "canEdit");
  });

  it("recusa texto vazio e campo a mais", async () => {
    const vazio = fakeRes();
    await createClientNote(fakeReq({ id: "c1" }, { text: "   " }), vazio);
    expect(vazio.statusCode).toBe(400);

    const extra = fakeRes();
    await createClientNote(fakeReq({ id: "c1" }, { text: "oi", tenantId: "outra" }), extra);
    expect(extra.statusCode).toBe(400);
    expect(added).toHaveLength(0);
  });

  it("sem permissão de editar não cria nem apaga", async () => {
    hasPagePermission.mockImplementation(async (_c: unknown, _p: string, action: string) => action === "canView");
    const criar = fakeRes();
    await createClientNote(fakeReq({ id: "c1" }, { text: "oi" }), criar);
    const apagar = fakeRes();
    await deleteClientNote(fakeReq({ id: "c1", noteId: "n1" }), apagar);
    expect(criar.statusCode).toBe(403);
    expect(apagar.statusCode).toBe(403);
    expect(deleted).toHaveLength(0);
  });

  it("apaga só anotação do mesmo contato e empresa", async () => {
    notes.n2 = { tenantId: "outra", clientId: "c1" };
    const outra = fakeRes();
    await deleteClientNote(fakeReq({ id: "c1", noteId: "n2" }), outra);
    expect(outra.statusCode).toBe(404);

    const ok = fakeRes();
    await deleteClientNote(fakeReq({ id: "c1", noteId: "n1" }), ok);
    expect(ok.statusCode).toBe(200);
    expect(deleted).toEqual(["n1"]);
  });
});
