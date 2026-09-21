import type { NextFunction, Request, Response } from "express";

const usersQueryDocs: Array<{ id: string; data: Record<string, unknown> }> = [];

jest.mock("../../../init", () => ({
  db: {
    collection: () => ({
      where: () => ({
        limit: () => ({
          get: async () => ({
            docs: usersQueryDocs.map((d) => ({ id: d.id, get: (f: string) => d.data[f] })),
          }),
        }),
      }),
    }),
  },
}));

const assertTenantExists = jest.fn(async (_id: string) => undefined);
jest.mock("../../../lib/tenant-resolution", () => ({
  assertTenantExists: (id: string) => assertTenantExists(id),
}));

const writeSecurityAuditEvent = jest.fn(async (_e: Record<string, unknown>) => undefined);
jest.mock("../../../lib/security-observability", () => ({
  writeSecurityAuditEvent: (e: Record<string, unknown>) => writeSecurityAuditEvent(e),
}));
jest.mock("../../../lib/logger", () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

import {
  clearImpersonationOwnerCacheForTest,
  resolveImpersonation,
} from "../impersonation";

interface Ctx {
  req: Request;
  res: Response;
  next: jest.Mock;
  status: jest.Mock;
  json: jest.Mock;
}

function build(
  user: Record<string, unknown> | undefined,
  opts: { method?: string; url?: string; headers?: Record<string, string> } = {},
): Ctx {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const req = {
    user,
    method: opts.method ?? "GET",
    originalUrl: opts.url ?? "/v1/proposals",
    headers: { ...(opts.headers ?? {}) },
  } as unknown as Request;
  return { req, res: { status } as unknown as Response, next: jest.fn(), status, json };
}

async function run(ctx: Ctx) {
  await resolveImpersonation(ctx.req, ctx.res, ctx.next as unknown as NextFunction);
}

const superadmin = () => ({ uid: "root", tenantId: "own", isSuperAdmin: true, role: "SUPERADMIN" });

beforeEach(() => {
  jest.clearAllMocks();
  clearImpersonationOwnerCacheForTest();
  usersQueryDocs.length = 0;
  usersQueryDocs.push(
    { id: "member", data: { masterId: "owner", createdAt: "2026-01-01" } },
    { id: "owner", data: { role: "MASTER", createdAt: "2025-05-01" } },
  );
});

describe("resolveImpersonation", () => {
  it("superadmin lendo outra empresa passa a agir nela, com o dono como master", async () => {
    const ctx = build(superadmin(), { headers: { "x-tenant-id": "alvo" } });
    await run(ctx);
    expect(ctx.next).toHaveBeenCalled();
    const user = ctx.req.user as unknown as Record<string, unknown>;
    expect(user.tenantId).toBe("alvo");
    expect(user.masterId).toBe("owner");
    expect(user.impersonation).toEqual({
      originalTenantId: "own",
      targetTenantId: "alvo",
      ownerUid: "owner",
      writeEnabled: false,
    });
  });

  it("escrita sem habilitar edicao leva 403 IMPERSONATION_READ_ONLY", async () => {
    const ctx = build(superadmin(), {
      method: "POST",
      url: "/v1/aux/ambientes",
      headers: { "x-tenant-id": "alvo" },
    });
    await run(ctx);
    expect(ctx.next).not.toHaveBeenCalled();
    expect(ctx.status).toHaveBeenCalledWith(403);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "IMPERSONATION_READ_ONLY" }),
    );
  });

  it("com edicao habilitada a escrita passa e e auditada", async () => {
    const ctx = build(superadmin(), {
      method: "DELETE",
      url: "/v1/products/p1?x=1",
      headers: { "x-tenant-id": "alvo", "x-impersonation-write": "1" },
    });
    await run(ctx);
    expect(ctx.next).toHaveBeenCalled();
    expect(writeSecurityAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "super_admin_tenant_write",
        tenantId: "alvo",
        route: "/v1/products/p1",
        uid: "root",
      }),
    );
  });

  it("rotas do proprio superadmin seguem gravando em modo leitura", async () => {
    for (const url of ["/v1/admin/impersonation/stop", "/v1/profile", "/v1/notifications/n1/read", "/v1/ai/chat"]) {
      const ctx = build(superadmin(), { method: "POST", url, headers: { "x-tenant-id": "alvo" } });
      await run(ctx);
      expect(ctx.next).toHaveBeenCalled();
    }
    expect(writeSecurityAuditEvent).not.toHaveBeenCalled();
  });

  it("prefixo parecido nao escapa do modo leitura", async () => {
    const ctx = build(superadmin(), {
      method: "POST",
      url: "/v1/administrativo",
      headers: { "x-tenant-id": "alvo" },
    });
    await run(ctx);
    expect(ctx.status).toHaveBeenCalledWith(403);
  });

  it("empresa inexistente responde 400 sem seguir", async () => {
    assertTenantExists.mockRejectedValueOnce(new Error("x"));
    const ctx = build(superadmin(), { headers: { "x-tenant-id": "fantasma" } });
    await run(ctx);
    expect(ctx.status).toHaveBeenCalledWith(400);
    expect(ctx.next).not.toHaveBeenCalled();
  });

  it("header igual ao proprio tenant nao e impersonacao", async () => {
    const ctx = build(superadmin(), { method: "POST", headers: { "x-tenant-id": "own" } });
    await run(ctx);
    expect(ctx.next).toHaveBeenCalled();
    expect((ctx.req.user as unknown as Record<string, unknown>).impersonation).toBeUndefined();
  });

  it.each([
    ["master", { uid: "m", tenantId: "t1", isSuperAdmin: false, role: "MASTER" }],
    ["membro", { uid: "u", tenantId: "t1", isSuperAdmin: false, role: "MEMBER" }],
    ["free", { uid: "f", tenantId: "t1", isSuperAdmin: false, role: "FREE" }],
  ])("%s nao troca de tenant pelo cabecalho", async (_label, user) => {
    const ctx = build(user, {
      method: "POST",
      headers: { "x-tenant-id": "outro", "x-impersonation-write": "1" },
    });
    await run(ctx);
    expect(ctx.next).toHaveBeenCalled();
    expect((ctx.req.user as unknown as Record<string, unknown>).tenantId).toBe("t1");
    expect(ctx.req.headers["x-tenant-id"]).toBeUndefined();
    expect(assertTenantExists).not.toHaveBeenCalled();
  });

  it("sem usuario autenticado nao faz nada", async () => {
    const ctx = build(undefined, { headers: { "x-tenant-id": "alvo" } });
    await run(ctx);
    expect(ctx.next).toHaveBeenCalled();
  });
});
