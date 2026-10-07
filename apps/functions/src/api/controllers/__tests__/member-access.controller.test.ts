/**
 * Gestão do acesso da equipe: suspender e reativar, encerrar sessões e o
 * histórico de ações. Só o dono e os administradores, só membro da própria
 * empresa, nunca a própria conta. O histórico aceita do navegador só a
 * exportação.
 */
import type { Request, Response } from "express";

type Doc = Record<string, unknown>;
const mockUsers: Record<string, Doc> = {};
const mockAudit: Doc[] = [];
const mockUpdates: Array<{ id: string; data: Doc }> = [];
const mockAuth = { updateUser: jest.fn(), revokeRefreshTokens: jest.fn() };
const mockQueries: Array<Array<[string, string, unknown]>> = [];

jest.mock("../../../init", () => {
  const query = (filters: Array<[string, string, unknown]>) => ({
    where: (field: string, op: string, value: unknown) => query([...filters, [field, op, value]]),
    orderBy: () => query(filters),
    limit: () => ({
      get: async () => {
        mockQueries.push(filters);
        return {
          docs: mockAudit
            .filter((entry) => filters.every(([f, op, v]) => (op === "==" ? entry[f] === v : true)))
            .map((entry, i) => ({ id: `a${i}`, data: () => entry })),
        };
      },
    }),
  });
  return {
    auth: mockAuth,
    db: {
      collection: (name: string) => {
        if (name === "users") {
          return {
            doc: (id: string) => ({
              get: async () => ({ exists: Boolean(mockUsers[id]), data: () => mockUsers[id] }),
              update: async (data: Doc) => {
                mockUpdates.push({ id, data });
              },
            }),
          };
        }
        return {
          add: async (data: Doc) => {
            mockAudit.push(data);
            return { id: "novo" };
          },
          where: (field: string, op: string, value: unknown) => query([[field, op, value]]),
        };
      },
    },
  };
});
jest.mock("../../../lib/token-revocation", () => ({ invalidateRevocationState: jest.fn() }));

import {
  listMemberAudit,
  reactivateMember,
  reportAuditEvent,
  revokeMemberSessions,
  suspendMember,
} from "../member-access.controller";

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
    send() {
      return res;
    },
  };
  return res as unknown as Response & { statusCode: number; body: { entries?: Doc[] } };
}

const req = (opts: { uid?: string; role?: string; params?: Doc; query?: Doc; body?: Doc } = {}) =>
  ({
    user: { uid: opts.uid ?? "dono", role: opts.role ?? "MASTER", tenantId: "t1", isSuperAdmin: false },
    params: opts.params ?? {},
    query: opts.query ?? {},
    body: opts.body ?? {},
  }) as unknown as Request;

beforeEach(() => {
  for (const key of Object.keys(mockUsers)) delete mockUsers[key];
  mockAudit.length = 0;
  mockUpdates.length = 0;
  mockQueries.length = 0;
  jest.clearAllMocks();
  mockUsers.dono = { tenantId: "t1", role: "MASTER", name: "Dono" };
  mockUsers.vend = { tenantId: "t1", role: "MEMBER", name: "Vendedora" };
  mockUsers.adm = { tenantId: "t1", role: "ADMIN", name: "Admin" };
  mockUsers.fora = { tenantId: "t2", role: "MEMBER", name: "De fora" };
});

describe("suspender, reativar e encerrar sessões", () => {
  it("suspender desativa a conta, derruba as sessões, marca o status e vai ao histórico", async () => {
    const res = fakeRes();
    await suspendMember(req({ params: { id: "vend" } }), res);
    expect(res.statusCode).toBe(200);
    expect(mockAuth.updateUser).toHaveBeenCalledWith("vend", { disabled: true });
    expect(mockAuth.revokeRefreshTokens).toHaveBeenCalledWith("vend");
    expect(mockUpdates[0]).toMatchObject({ id: "vend", data: { status: "suspended" } });
    expect(mockAudit[0]).toMatchObject({ action: "member_suspended", targetId: "vend", actorUid: "dono", actorName: "Dono" });
  });

  it("reativar liga a conta de novo", async () => {
    const res = fakeRes();
    await reactivateMember(req({ params: { id: "vend" } }), res);
    expect(mockAuth.updateUser).toHaveBeenCalledWith("vend", { disabled: false });
    expect(mockUpdates[0]).toMatchObject({ data: { status: "active" } });
  });

  it("encerrar sessões não suspende", async () => {
    const res = fakeRes();
    await revokeMemberSessions(req({ params: { id: "vend" } }), res);
    expect(mockAuth.revokeRefreshTokens).toHaveBeenCalledWith("vend");
    expect(mockAuth.updateUser).not.toHaveBeenCalled();
    expect(mockAudit[0]).toMatchObject({ action: "member_sessions_revoked" });
  });

  it("membro não suspende ninguém; ninguém suspende a si, um admin ou alguém de fora", async () => {
    const membro = fakeRes();
    await suspendMember(req({ uid: "vend", role: "MEMBER", params: { id: "dono" } }), membro);
    expect(membro.statusCode).toBe(403);

    const proprio = fakeRes();
    await suspendMember(req({ params: { id: "dono" } }), proprio);
    expect(proprio.statusCode).toBe(400);

    const admin = fakeRes();
    await suspendMember(req({ params: { id: "adm" } }), admin);
    expect(admin.statusCode).toBe(400);

    const fora = fakeRes();
    await suspendMember(req({ params: { id: "fora" } }), fora);
    expect(fora.statusCode).toBe(404);
    expect(mockAuth.updateUser).not.toHaveBeenCalled();
  });
});

describe("histórico", () => {
  it("lista a empresa de quem pede, com filtro por pessoa e ação", async () => {
    mockAudit.push(
      { tenantId: "t1", actorUid: "vend", action: "proposal_approved", createdAt: "2026-10-06T12:00:00.000Z" },
      { tenantId: "t2", actorUid: "x", action: "proposal_approved", createdAt: "2026-10-06T12:00:00.000Z" },
    );
    const res = fakeRes();
    await listMemberAudit(req({ query: { memberUid: "vend", action: "proposal_approved" } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.entries).toHaveLength(1);
    expect(mockQueries[0]).toEqual(
      expect.arrayContaining([
        ["tenantId", "==", "t1"],
        ["actorUid", "==", "vend"],
        ["action", "==", "proposal_approved"],
      ]),
    );
  });

  it("membro não lê o histórico; ação desconhecida é recusada", async () => {
    const membro = fakeRes();
    await listMemberAudit(req({ uid: "vend", role: "MEMBER" }), membro);
    expect(membro.statusCode).toBe(403);
    const acao = fakeRes();
    await listMemberAudit(req({ query: { action: "inventada" } }), acao);
    expect(acao.statusCode).toBe(400);
  });

  it("do navegador, só a exportação entra, com a identidade do token", async () => {
    const ok = fakeRes();
    await reportAuditEvent(
      req({ uid: "vend", role: "MEMBER", body: { action: "data_exported", target: { type: "export", label: "Lançamentos" } } }),
      ok,
    );
    expect(ok.statusCode).toBe(204);
    expect(mockAudit[0]).toMatchObject({ tenantId: "t1", actorUid: "vend", action: "data_exported", targetLabel: "Lançamentos" });

    const forjado = fakeRes();
    await reportAuditEvent(
      req({ uid: "vend", role: "MEMBER", body: { action: "proposal_approved", target: { type: "proposal" } } }),
      forjado,
    );
    expect(forjado.statusCode).toBe(400);
    expect(mockAudit).toHaveLength(1);
  });
});
