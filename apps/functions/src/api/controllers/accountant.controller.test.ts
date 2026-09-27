/**
 * Link do contador: só dono e administradores gerenciam; as rotas públicas
 * passam o token ao serviço e não deixam cache.
 */

const svc = {
  getAccountantLink: jest.fn(),
  ensureAccountantLink: jest.fn(),
  rotateAccountantLink: jest.fn(),
  revokeAccountantLink: jest.fn(),
  accountantOverview: jest.fn(),
  accountantDre: jest.fn(),
  accountantTransactions: jest.fn(),
  accountantInvoices: jest.fn(),
  accountantReceived: jest.fn(),
  accountantDocument: jest.fn(),
};

jest.mock("../services/accountant/accountant.service", () => {
  class AccountantError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  }
  const proxied = Object.fromEntries(Object.keys(svc).map((k) => [k, (...a: unknown[]) => svc[k as keyof typeof svc](...a)]));
  return { AccountantError, ...proxied };
});
jest.mock("../services/finance-reports/dre.service", () => ({ DreError: class DreError extends Error {} }));
jest.mock("../../lib/logger", () => ({ logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() } }));

import type { Request, Response } from "express";
import {
  createAccountantLinkHandler,
  getAccountantDocumentHandler,
  getAccountantDreHandler,
  getAccountantLinkHandler,
  revokeAccountantLinkHandler,
  rotateAccountantLinkHandler,
} from "./accountant.controller";

interface FakeResponse {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
  redirectedTo?: string;
  status: (code: number) => FakeResponse;
  json: (body: unknown) => FakeResponse;
  set: (name: string, value: string) => FakeResponse;
  send: (body: unknown) => FakeResponse;
  redirect: (code: number, url: string) => FakeResponse;
}

function res(): FakeResponse & Response {
  const r: FakeResponse = {
    statusCode: 200,
    body: undefined,
    headers: {},
    status: (code) => ((r.statusCode = code), r),
    json: (body) => ((r.body = body), r),
    set: (name, value) => ((r.headers[name] = value), r),
    send: (body) => ((r.body = body), r),
    redirect: (code, url) => ((r.statusCode = code), (r.redirectedTo = url), r),
  };
  return r as FakeResponse & Response;
}

function req(role: string, extra: Partial<Request> = {}): Request {
  return {
    params: { token: "tok_abcdefghijklmnop", source: "invoice", id: "n1" },
    query: {},
    body: {},
    user: { uid: "u1", role, tenantId: "t1" },
    ...extra,
  } as unknown as Request;
}

beforeEach(() => {
  jest.clearAllMocks();
  svc.getAccountantLink.mockResolvedValue({ url: null });
  svc.ensureAccountantLink.mockResolvedValue({ url: "u" });
  svc.rotateAccountantLink.mockResolvedValue({ url: "u2" });
  svc.accountantDre.mockResolvedValue({ months: [] });
});

describe("gerenciar o link", () => {
  it.each([
    ["ver", getAccountantLinkHandler, "getAccountantLink"],
    ["criar", createAccountantLinkHandler, "ensureAccountantLink"],
    ["trocar", rotateAccountantLinkHandler, "rotateAccountantLink"],
    ["desligar", revokeAccountantLinkHandler, "revokeAccountantLink"],
  ] as const)("membro não pode %s", async (_n, handler, method) => {
    const r = res();
    await handler(req("MEMBER"), r);
    expect(r.statusCode).toBe(403);
    expect(svc[method]).not.toHaveBeenCalled();
  });

  it("o dono cria no tenant dele", async () => {
    await createAccountantLinkHandler(req("MASTER"), res());
    expect(svc.ensureAccountantLink).toHaveBeenCalledWith("t1", "u1");
  });
});

describe("rotas públicas", () => {
  it("DRE: token do caminho, caixa como padrão e sem cache", async () => {
    const r = res();
    await getAccountantDreHandler(req("", { query: { from: "2026-09", to: "2026-09" } } as Partial<Request>), r);
    expect(svc.accountantDre).toHaveBeenCalledWith("tok_abcdefghijklmnop", { from: "2026-09", to: "2026-09", basis: "cash" });
    expect(r.headers["Cache-Control"]).toBe("no-store");
  });

  it("documento: tipo inválido ou origem inválida é 400", async () => {
    const r1 = res();
    await getAccountantDocumentHandler(req("", { query: { kind: "exe" } } as Partial<Request>), r1);
    expect(r1.statusCode).toBe(400);
    const r2 = res();
    await getAccountantDocumentHandler(
      req("", { query: { kind: "pdf" }, params: { token: "tok_abcdefghijklmnop", source: "outra", id: "n1" } } as unknown as Partial<Request>),
      r2,
    );
    expect(r2.statusCode).toBe(400);
    expect(svc.accountantDocument).not.toHaveBeenCalled();
  });

  it("documento do Storage sai como anexo; o do provedor redireciona", async () => {
    svc.accountantDocument.mockResolvedValueOnce({ buffer: Buffer.from("x"), fileName: "nota-10.xml" });
    const r = res();
    await getAccountantDocumentHandler(req("", { query: { kind: "xml" } } as Partial<Request>), r);
    expect(r.headers["Content-Type"]).toBe("application/xml");
    expect(r.headers["Content-Disposition"]).toBe('attachment; filename="nota-10.xml"');

    svc.accountantDocument.mockResolvedValueOnce({ redirect: "https://focus/n1.pdf" });
    const r2 = res();
    await getAccountantDocumentHandler(req("", { query: { kind: "pdf" } } as Partial<Request>), r2);
    expect(r2.redirectedTo).toBe("https://focus/n1.pdf");
  });
});
