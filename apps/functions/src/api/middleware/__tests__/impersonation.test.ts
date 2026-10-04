import type { NextFunction, Request, Response } from "express";

const usersQueryDocs: Array<{ id: string; data: Record<string, unknown> }> = [];
const userDocs: Record<string, Record<string, unknown>> = {};

jest.mock("../../../init", () => ({
  db: {
    collection: () => ({
      doc: (id: string) => ({
        get: async () => ({
          exists: Boolean(userDocs[id]),
          data: () => userDocs[id],
        }),
      }),
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
  for (const key of Object.keys(userDocs)) delete userDocs[key];
  userDocs.vendedor = { role: "MEMBER", tenantId: "alvo", masterId: "owner", name: "Vendedor" };
  userDocs.gerente = { role: "ADMIN", tenantId: "alvo", masterId: "owner" };
  userDocs.deOutra = { role: "MEMBER", tenantId: "outra", masterId: "x" };
  userDocs.root2 = { role: "SUPERADMIN", tenantId: "alvo" };
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

  describe("ver como membro", () => {
    const asMember = (memberUid: string, extra: Record<string, string> = {}) => ({
      "x-tenant-id": "alvo",
      "x-view-as-member": memberUid,
      ...extra,
    });

    it("a request passa a valer como o membro, com o superadmin registrado", async () => {
      const ctx = build(superadmin(), { headers: asMember("vendedor") });
      await run(ctx);
      expect(ctx.next).toHaveBeenCalled();
      const user = ctx.req.user as unknown as Record<string, unknown>;
      expect(user.uid).toBe("vendedor");
      expect(user.role).toBe("MEMBER");
      expect(user.isSuperAdmin).toBe(false);
      expect(user.tenantId).toBe("alvo");
      expect(user.masterId).toBe("owner");
      expect(user.userDoc).toEqual(userDocs.vendedor);
      expect(user.impersonation).toEqual({
        originalTenantId: "own",
        targetTenantId: "alvo",
        ownerUid: "owner",
        writeEnabled: false,
        memberUid: "vendedor",
        actorUid: "root",
      });
    });

    it("administrador da empresa tambem pode ser visto, com o papel dele", async () => {
      const ctx = build(superadmin(), { headers: asMember("gerente") });
      await run(ctx);
      expect((ctx.req.user as unknown as Record<string, unknown>).role).toBe("ADMIN");
    });

    it.each([
      ["de outra empresa", "deOutra"],
      ["superadmin", "root2"],
      ["inexistente", "fantasma"],
    ])("membro %s leva 400 MEMBER_VIEW_NOT_FOUND", async (_label, uid) => {
      const ctx = build(superadmin(), { headers: asMember(uid) });
      await run(ctx);
      expect(ctx.next).not.toHaveBeenCalled();
      expect(ctx.status).toHaveBeenCalledWith(400);
      expect(ctx.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: "MEMBER_VIEW_NOT_FOUND" }),
      );
    });

    it("escrita e recusada mesmo com edicao habilitada", async () => {
      const ctx = build(superadmin(), {
        method: "PUT",
        url: "/v1/proposals/p1",
        headers: asMember("vendedor", { "x-impersonation-write": "1" }),
      });
      await run(ctx);
      expect(ctx.next).not.toHaveBeenCalled();
      expect(ctx.status).toHaveBeenCalledWith(403);
      expect(ctx.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: "MEMBER_VIEW_READ_ONLY" }),
      );
      expect(writeSecurityAuditEvent).not.toHaveBeenCalled();
    });

    it.each(["/v1/notifications/n1/read", "/v1/ai/chat"])(
      "%s nao grava em nome do membro",
      async (url) => {
        const ctx = build(superadmin(), { method: "POST", url, headers: asMember("vendedor") });
        await run(ctx);
        expect(ctx.status).toHaveBeenCalledWith(403);
        expect(ctx.next).not.toHaveBeenCalled();
      },
    );

    it.each(["/v1/admin/impersonation/stop", "/v1/profile"])(
      "%s continua agindo como o superadmin",
      async (url) => {
        const ctx = build(superadmin(), { method: "POST", url, headers: asMember("vendedor") });
        await run(ctx);
        expect(ctx.next).toHaveBeenCalled();
        const user = ctx.req.user as unknown as Record<string, unknown>;
        expect(user.uid).toBe("root");
        expect(user.isSuperAdmin).toBe(true);
        expect(user.role).toBe("SUPERADMIN");
      },
    );

    it("sem x-tenant-id o cabecalho do membro e ignorado", async () => {
      const ctx = build(superadmin(), { headers: { "x-view-as-member": "vendedor" } });
      await run(ctx);
      expect(ctx.next).toHaveBeenCalled();
      const user = ctx.req.user as unknown as Record<string, unknown>;
      expect(user.uid).toBe("root");
      expect(user.impersonation).toBeUndefined();
    });

    it.each([
      ["master", { uid: "m", tenantId: "alvo", isSuperAdmin: false, role: "MASTER" }],
      ["membro", { uid: "u", tenantId: "alvo", isSuperAdmin: false, role: "MEMBER" }],
      ["free", { uid: "f", tenantId: "alvo", isSuperAdmin: false, role: "FREE" }],
    ])("%s nao vira outro usuario pelo cabecalho", async (_label, user) => {
      const ctx = build(user, { headers: asMember("vendedor") });
      await run(ctx);
      expect(ctx.next).toHaveBeenCalled();
      expect((ctx.req.user as unknown as Record<string, unknown>).uid).toBe(user.uid);
      expect(ctx.req.headers["x-view-as-member"]).toBeUndefined();
    });
  });
});
