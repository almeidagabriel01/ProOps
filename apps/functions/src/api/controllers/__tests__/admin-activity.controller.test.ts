/**
 * Leitura da atividade das empresas no painel do super admin: quem pode ler,
 * qual índice cada combinação de filtro usa e a paginação por cursor.
 */

import { Timestamp } from "firebase-admin/firestore";

type FakeDoc = { id: string; data: () => Record<string, unknown>; get: (f: string) => unknown };

const calls: { where: Array<[string, string, unknown]>; startAfter: unknown[] | null; limit: number | null } = {
  where: [],
  startAfter: null,
  limit: null,
};
let docs: FakeDoc[] = [];

function makeQuery() {
  const q = {
    where: (field: string, op: string, value: unknown) => {
      calls.where.push([field, op, value]);
      return q;
    },
    orderBy: () => q,
    startAfter: (...args: unknown[]) => {
      calls.startAfter = args;
      return q;
    },
    limit: (n: number) => {
      calls.limit = n;
      return q;
    },
    get: async () => ({ docs: docs.slice(0, calls.limit ?? docs.length) }),
  };
  return q;
}

jest.mock("../../../init", () => ({ db: { collection: () => makeQuery() } }));
jest.mock("../../../lib/admin-actors", () => ({
  withActors: async (events: Array<Record<string, unknown>>) =>
    events.map((e) => ({ ...e, actor: e.uid ? { uid: e.uid, name: "Ana" } : undefined })),
}));
jest.mock("../../../lib/logger", () => ({ logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } }));

import type { Request, Response } from "express";
import {
  ACTIVITY_SCAN_LIMIT,
  decodeActivityCursor,
  encodeActivityCursor,
  listTenantActivity,
  planActivityQuery,
} from "../admin-activity.controller";

function fakeDoc(i: number, data: Record<string, unknown> = {}): FakeDoc {
  const full = {
    tenantId: "t1",
    uid: "u1",
    type: "page_view",
    category: "navigation",
    route: "/dashboard",
    meta: {},
    createdAt: Timestamp.fromMillis(Date.parse("2026-10-03T15:00:00Z") - i * 1000),
    ...data,
  };
  return { id: `e${i}`, data: () => full, get: (f: string) => (full as Record<string, unknown>)[f] };
}

interface ResState {
  statusCode: number;
  body: unknown;
}

function res(): Response & { state: ResState } {
  const state: ResState = { statusCode: 200, body: undefined };
  const r: Record<string, unknown> = { state };
  r.status = (c: number) => {
    state.statusCode = c;
    return r;
  };
  r.json = (b: unknown) => {
    state.body = b;
    return r;
  };
  return r as unknown as Response & { state: ResState };
}

const SUPER = { uid: "s1", role: "SUPERADMIN", isSuperAdmin: true, tenantId: "" };

function req(query: Record<string, unknown>, user: Record<string, unknown> | null = SUPER): Request {
  return { query, user } as unknown as Request;
}

beforeEach(() => {
  calls.where = [];
  calls.startAfter = null;
  calls.limit = null;
  docs = [];
});

describe("GET /v1/admin/activity", () => {
  it.each([
    ["admin de empresa", { uid: "a1", role: "ADMIN", isSuperAdmin: false, tenantId: "t1" }],
    ["conta free", { uid: "f1", role: "FREE", isSuperAdmin: false, tenantId: "t1" }],
    ["sem login", null],
  ])("%s leva 403", async (_label, user) => {
    const r = res();
    await listTenantActivity(req({ tenantId: "t1" }, user as Record<string, unknown> | null), r);
    expect(r.state.statusCode).toBe(403);
  });

  it("devolve os eventos com quem agiu e data em ISO", async () => {
    docs = [fakeDoc(0)];
    const r = res();
    await listTenantActivity(req({ tenantId: "t1" }), r);
    const body = r.state.body as { events: Array<Record<string, unknown>>; nextCursor: string | null };
    expect(body.events[0]).toMatchObject({
      id: "e0",
      tenantId: "t1",
      type: "page_view",
      createdAt: "2026-10-03T15:00:00.000Z",
      actor: { uid: "u1", name: "Ana" },
    });
    expect(body.nextCursor).toBeNull();
    expect(calls.where).toEqual([["tenantId", "==", "t1"]]);
  });

  it("página cheia devolve cursor, e o cursor volta como startAfter", async () => {
    docs = Array.from({ length: 6 }, (_, i) => fakeDoc(i));
    const r = res();
    await listTenantActivity(req({ tenantId: "t1", limit: "5" }), r);
    const body = r.state.body as { events: unknown[]; nextCursor: string };
    expect(body.events).toHaveLength(5);
    expect(calls.limit).toBe(6);

    calls.limit = null;
    await listTenantActivity(req({ tenantId: "t1", limit: "5", cursor: body.nextCursor }), res());
    const [ts, id] = calls.startAfter as [Timestamp, string];
    expect(id).toBe("e4");
    expect(ts.toMillis()).toBe((docs[4].get("createdAt") as Timestamp).toMillis());
  });

  it("limite acima de 100 é cortado", async () => {
    await listTenantActivity(req({ limit: "5000" }), res());
    expect(calls.limit).toBe(101);
  });

  it("filtro por tipo roda em memória sobre a janela da categoria", async () => {
    docs = [
      fakeDoc(0, { type: "api_error", category: "error" }),
      fakeDoc(1, { type: "client_error", category: "error" }),
      fakeDoc(2, { type: "api_error", category: "error" }),
    ];
    const r = res();
    await listTenantActivity(req({ tenantId: "t1", type: "api_error" }), r);
    expect(calls.where).toEqual([
      ["tenantId", "==", "t1"],
      ["category", "==", "error"],
    ]);
    expect(calls.limit).toBe(ACTIVITY_SCAN_LIMIT);
    expect((r.state.body as { events: Array<{ type: string }> }).events.map((e) => e.type)).toEqual(["api_error", "api_error"]);
  });

  it("cursor ilegível volta para a primeira página em vez de falhar", async () => {
    const r = res();
    await listTenantActivity(req({ tenantId: "t1", cursor: "lixo" }), r);
    expect(r.state.statusCode).toBe(200);
    expect(calls.startAfter).toBeNull();
  });

  it("categoria e tipo contraditórios devolvem vazio sem consultar", async () => {
    const r = res();
    await listTenantActivity(req({ category: "navigation", type: "api_error" }), r);
    expect(r.state.body).toEqual({ events: [], nextCursor: null });
    expect(calls.limit).toBeNull();
  });
});

describe("planActivityQuery", () => {
  it.each([
    [{ tenantId: "t1" }, [["tenantId", "t1"]], {}],
    [{ tenantId: "t1", category: "error" }, [["tenantId", "t1"], ["category", "error"]], {}],
    [{ tenantId: "t1", uid: "u1" }, [["tenantId", "t1"], ["uid", "u1"]], {}],
    [{ tenantId: "t1", uid: "u1", category: "funnel" }, [["tenantId", "t1"], ["uid", "u1"]], { category: "funnel" }],
    [{ category: "error" }, [["category", "error"]], {}],
    [{}, [], {}],
    [{ uid: "u1" }, [], { uid: "u1" }],
    [{ type: "subscribe_clicked" }, [["category", "funnel"]], { type: "subscribe_clicked" }],
  ] as const)("%j", (filters, equals, memory) => {
    const plan = planActivityQuery(filters as never);
    expect(plan.empty).toBe(false);
    expect(plan.equals).toEqual(equals);
    expect(plan.memory).toEqual({ ...memory, ...("type" in filters ? { type: filters.type } : {}) });
  });
});

describe("cursor", () => {
  it("ida e volta preserva o nanossegundo", () => {
    const ts = new Timestamp(1_790_000_000, 123_456_789);
    const decoded = decodeActivityCursor(encodeActivityCursor(ts, "abc"))!;
    expect(decoded.id).toBe("abc");
    expect(decoded.createdAt.isEqual(ts)).toBe(true);
  });

  it.each([undefined, "", "lixo", Buffer.from('{"v":"x","id":"a"}').toString("base64")])("%s é ilegível", (raw) => {
    expect(decodeActivityCursor(raw)).toBeNull();
  });
});
