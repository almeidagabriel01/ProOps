/**
 * O PDF da proposta e o link compartilhável carregam os valores da venda.
 * Os dois conferiam só a empresa: o técnico de campo, sem a permissão de ver
 * propostas, baixava o PDF de qualquer proposta pelo id. Agora o membro
 * precisa de "Ver" em Propostas (users/{uid}/permissions/proposals); dono,
 * administradores e superadmin passam como antes.
 *
 * A permissão é a de verdade (`hasPagePermission`), lida de um Firestore
 * falso, para o bypass de administrador também estar em teste.
 */

import type { Request, Response } from "express";

let permissionDocs: Record<string, Record<string, Record<string, unknown>>>;
let proposals: Record<string, Record<string, unknown>>;

const getOrGenerateProposalPdf = jest.fn();
const createShareLink = jest.fn();

jest.mock("../../init", () => ({
  auth: {},
  db: {
    collection: (name: string) => {
      if (name === "users") {
        return {
          doc: (uid: string) => ({
            get: async () => ({ exists: true, data: () => ({ tenantId: "t1", role: "MEMBER" }) }),
            collection: () => ({
              doc: (pageId: string) => ({
                get: async () => {
                  const data = permissionDocs[uid]?.[pageId];
                  return { exists: !!data, data: () => data };
                },
              }),
            }),
          }),
        };
      }
      if (name === "proposals") {
        return {
          doc: (id: string) => ({
            get: async () => ({ exists: !!proposals[id], data: () => proposals[id] }),
          }),
        };
      }
      throw new Error(`coleção inesperada: ${name}`);
    },
  },
}));

jest.mock("../services/proposal-pdf.service", () => ({
  getOrGenerateProposalPdf: (...a: unknown[]) => getOrGenerateProposalPdf(...a),
}));

jest.mock("../services/shared-proposal.service", () => ({
  SharedProposalService: {
    createShareLink: (...a: unknown[]) => createShareLink(...a),
  },
}));

jest.mock("./proposal-online-approval.controller", () => ({
  resolveOnlineApprovalState: jest.fn(),
}));

jest.mock("../../lib/client-ip", () => ({ resolveClientIp: () => "200.1.2.3" }));

import { downloadProposalPdf } from "./proposal-pdf.controller";
import { createShareLink as createShareLinkHandler } from "./shared-proposals.controller";

function fakeRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    headersSent: false,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
    send(body: unknown) {
      res.body = body;
      return res;
    },
    setHeader(name: string, value: string) {
      res.headers[name] = value;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

function fakeReq(role: string, uid = "u1") {
  return {
    params: { id: "prop1" },
    body: {},
    headers: {},
    user: {
      uid,
      tenantId: "t1",
      role,
      masterId: "dono",
      isSuperAdmin: role === "SUPERADMIN",
      hasRequiredClaims: true,
    },
  } as unknown as Request;
}

beforeEach(() => {
  jest.clearAllMocks();
  permissionDocs = {};
  proposals = { prop1: { tenantId: "t1", title: "Casa" } };
  getOrGenerateProposalPdf.mockResolvedValue({
    buffer: Buffer.from("%PDF-"),
    proposalTitle: "Casa",
  });
  createShareLink.mockResolvedValue({ shareUrl: "https://erp/share/tok", token: "tok" });
});

describe("GET /v1/proposals/:id/pdf", () => {
  it("membro sem permissão de propostas leva 403 e o PDF nem é montado", async () => {
    permissionDocs = {
      u1: {
        service_orders: { canView: true, canEdit: true },
        equipment: { canView: true },
        calendar: { canView: true },
      },
    };
    const res = fakeRes();
    await downloadProposalPdf(fakeReq("MEMBER"), res);
    expect(res.statusCode).toBe(403);
    expect(getOrGenerateProposalPdf).not.toHaveBeenCalled();
  });

  it("membro só com o CRM também não baixa o PDF", async () => {
    permissionDocs = { u1: { kanban: { canView: true } } };
    const res = fakeRes();
    await downloadProposalPdf(fakeReq("MEMBER"), res);
    expect(res.statusCode).toBe(403);
  });

  it("membro com a permissão desligada (canView false) leva 403", async () => {
    permissionDocs = { u1: { proposals: { canView: false } } };
    const res = fakeRes();
    await downloadProposalPdf(fakeReq("MEMBER"), res);
    expect(res.statusCode).toBe(403);
  });

  it("membro com 'Ver' em propostas baixa", async () => {
    permissionDocs = { u1: { proposals: { canView: true } } };
    const res = fakeRes();
    await downloadProposalPdf(fakeReq("MEMBER"), res);
    expect(res.statusCode).toBe(200);
    expect(getOrGenerateProposalPdf).toHaveBeenCalledWith("t1", "prop1", false);
  });

  it.each(["MASTER", "ADMIN", "WK"])("%s baixa sem doc de permissão", async (role) => {
    const res = fakeRes();
    await downloadProposalPdf(fakeReq(role, "dono"), res);
    expect(res.statusCode).toBe(200);
  });

  it("superadmin baixa", async () => {
    const res = fakeRes();
    await downloadProposalPdf(fakeReq("SUPERADMIN", "sa"), res);
    expect(res.statusCode).toBe(200);
    expect(getOrGenerateProposalPdf).toHaveBeenCalledWith("t1", "prop1", true);
  });

  it("conta free leva 403 (a demonstração não baixa PDF)", async () => {
    const res = fakeRes();
    await downloadProposalPdf(fakeReq("free", "free1"), res);
    expect(res.statusCode).toBe(403);
  });
});

describe("POST /v1/proposals/:id/share-link", () => {
  it("membro sem permissão de propostas leva 403 e o link não é criado", async () => {
    permissionDocs = { u1: { service_orders: { canView: true } } };
    const res = fakeRes();
    await createShareLinkHandler(fakeReq("MEMBER"), res);
    expect(res.statusCode).toBe(403);
    expect(createShareLink).not.toHaveBeenCalled();
  });

  it("membro com 'Ver' em propostas gera o link", async () => {
    permissionDocs = { u1: { proposals: { canView: true } } };
    const res = fakeRes();
    await createShareLinkHandler(fakeReq("MEMBER"), res);
    expect(res.statusCode).toBe(201);
    expect(createShareLink).toHaveBeenCalledWith("prop1", "t1", "u1");
  });

  it("master gera o link", async () => {
    const res = fakeRes();
    await createShareLinkHandler(fakeReq("MASTER", "dono"), res);
    expect(res.statusCode).toBe(201);
  });
});
