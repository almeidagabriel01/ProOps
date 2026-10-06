/**
 * Portal do cliente: ver o link pede ver Contatos; criar, trocar e desligar
 * pedem editar Contatos. O tenant vem sempre do usuário logado.
 */

const svc = {
  getPortalLink: jest.fn(),
  ensurePortalLink: jest.fn(),
  rotatePortalLink: jest.fn(),
  revokePortalLink: jest.fn(),
  publicPortalView: jest.fn(),
  openPortalItem: jest.fn(),
};

jest.mock("../services/client-portal/client-portal.service", () => {
  class ClientPortalError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    ClientPortalError,
    getPortalLink: (...a: unknown[]) => svc.getPortalLink(...a),
    ensurePortalLink: (...a: unknown[]) => svc.ensurePortalLink(...a),
    rotatePortalLink: (...a: unknown[]) => svc.rotatePortalLink(...a),
    revokePortalLink: (...a: unknown[]) => svc.revokePortalLink(...a),
    publicPortalView: (...a: unknown[]) => svc.publicPortalView(...a),
    openPortalItem: (...a: unknown[]) => svc.openPortalItem(...a),
  };
});

const hasPagePermission = jest.fn();
jest.mock("../../lib/auth-helpers", () => ({
  hasPagePermission: (...a: unknown[]) => hasPagePermission(...a),
}));

import type { Request, Response } from "express";
import {
  createClientPortalLink,
  getClientPortalLink,
  getPublicClientPortal,
  openPublicClientPortalItem,
  revokeClientPortalLink,
  rotateClientPortalLink,
} from "./client-portal.controller";

interface FakeResponse {
  statusCode: number;
  body: Record<string, unknown>;
  headers: Record<string, string>;
  status: (code: number) => FakeResponse;
  json: (body: Record<string, unknown>) => FakeResponse;
  set: (name: string, value: string) => FakeResponse;
}

function res(): FakeResponse & Response {
  const r: FakeResponse = {
    statusCode: 200,
    body: {},
    headers: {},
    status: (code) => {
      r.statusCode = code;
      return r;
    },
    json: (body) => {
      r.body = body;
      return r;
    },
    set: (name, value) => {
      r.headers[name] = value;
      return r;
    },
  };
  return r as FakeResponse & Response;
}

function req(extra: Partial<Request> = {}): Request {
  return {
    params: { clientId: "c1", token: "tok_abcdefghijklmnop" },
    body: {},
    user: { uid: "u1", role: "MEMBER", tenantId: "t1" },
    ...extra,
  } as unknown as Request;
}

beforeEach(() => {
  jest.clearAllMocks();
  hasPagePermission.mockResolvedValue(true);
  svc.getPortalLink.mockResolvedValue({ url: null });
  svc.ensurePortalLink.mockResolvedValue({ url: "https://x/share/portal/a" });
  svc.rotatePortalLink.mockResolvedValue({ url: "https://x/share/portal/b" });
});

describe("link do portal (empresa)", () => {
  it("ver pede canView de Contatos", async () => {
    await getClientPortalLink(req(), res());
    expect(hasPagePermission).toHaveBeenCalledWith(expect.anything(), "clients", "canView");
    expect(svc.getPortalLink).toHaveBeenCalledWith("t1", "c1");
  });

  it.each([
    ["criar", createClientPortalLink, "ensurePortalLink"],
    ["trocar", rotateClientPortalLink, "rotatePortalLink"],
    ["desligar", revokeClientPortalLink, "revokePortalLink"],
  ] as const)("%s sem editar Contatos: 403 e nada muda", async (_name, handler, method) => {
    hasPagePermission.mockResolvedValue(false);
    const r = res();
    await handler(req(), r);
    expect(r.statusCode).toBe(403);
    expect(hasPagePermission).toHaveBeenCalledWith(expect.anything(), "clients", "canEdit");
    expect(svc[method]).not.toHaveBeenCalled();
  });

  describe("o portal abre propostas e pagamentos", () => {
    const only = (granted: string[]) =>
      hasPagePermission.mockImplementation(async (_c: unknown, pageId: string, action: string) =>
        granted.includes(`${pageId}.${action}`),
      );

    it.each([
      ["ver", getClientPortalLink, "getPortalLink", "clients.canView"],
      ["criar", createClientPortalLink, "ensurePortalLink", "clients.canEdit"],
      ["trocar", rotateClientPortalLink, "rotatePortalLink", "clients.canEdit"],
    ] as const)("%s só com Contatos, sem Propostas nem Lançamentos: 403", async (_n, handler, method, clients) => {
      only([clients]);
      const r = res();
      await handler(req(), r);
      expect(r.statusCode).toBe(403);
      expect(svc[method]).not.toHaveBeenCalled();
    });

    it.each(["proposals.canView", "transactions.canView"])("com Contatos e %s, cria o link", async (extra) => {
      only(["clients.canEdit", extra]);
      const r = res();
      await createClientPortalLink(req(), r);
      expect(svc.ensurePortalLink).toHaveBeenCalled();
    });

    it("desligar só fecha o acesso: pede só editar Contatos", async () => {
      only(["clients.canEdit"]);
      const r = res();
      await revokeClientPortalLink(req(), r);
      expect(svc.revokePortalLink).toHaveBeenCalledWith("t1", "c1");
    });
  });

  it("criar e trocar usam o tenant do usuário, não o do corpo", async () => {
    await createClientPortalLink(req({ body: { tenantId: "outro" } }), res());
    expect(svc.ensurePortalLink).toHaveBeenCalledWith("t1", "c1", "u1");
    await rotateClientPortalLink(req(), res());
    expect(svc.rotatePortalLink).toHaveBeenCalledWith("t1", "c1", "u1");
  });

  it("contato de outra empresa: o 404 do serviço chega como 404", async () => {
    const { ClientPortalError } = jest.requireMock("../services/client-portal/client-portal.service");
    svc.ensurePortalLink.mockRejectedValue(new ClientPortalError(404, "Contato não encontrado."));
    const r = res();
    await createClientPortalLink(req(), r);
    expect(r.statusCode).toBe(404);
  });
});

describe("portal público", () => {
  it("a página vai sem cache", async () => {
    svc.publicPortalView.mockResolvedValue({ proposals: [] });
    const r = res();
    await getPublicClientPortal(req(), r);
    expect(r.headers["Cache-Control"]).toBe("no-store");
    expect(svc.publicPortalView).toHaveBeenCalledWith("tok_abcdefghijklmnop");
  });

  it("abrir item valida o tipo antes do serviço", async () => {
    const r = res();
    await openPublicClientPortalItem(req({ body: { kind: "invoice", id: "x" } }), r);
    expect(r.statusCode).toBe(400);
    expect(svc.openPortalItem).not.toHaveBeenCalled();
  });

  it("abrir item válido", async () => {
    svc.openPortalItem.mockResolvedValue({ url: "https://x/share/abc" });
    const r = res();
    await openPublicClientPortalItem(req({ body: { kind: "proposal", id: "p1" } }), r);
    expect(r.body).toEqual({ url: "https://x/share/abc" });
    expect(svc.openPortalItem).toHaveBeenCalledWith("tok_abcdefghijklmnop", "proposal", "p1");
  });
});
