/**
 * O link público do lançamento (que abre o Pix e o boleto do Asaas) e o PDF
 * do recibo conferiam só a empresa: qualquer membro, inclusive a vendedora
 * sem acesso ao financeiro, gerava a cobrança de qualquer lançamento e baixava
 * o recibo pelo id. Agora:
 *
 * - criar ou trocar o link exige "Editar" em Lançamentos;
 * - consultar o link e baixar o recibo exigem "Ver" em Lançamentos.
 *
 * A permissão é a de verdade (`hasPagePermission`), lida de um Firestore falso.
 */

import type { Request, Response } from "express";

let permissionDocs: Record<string, Record<string, Record<string, unknown>>>;
let transactions: Record<string, Record<string, unknown>>;

const createShareLink = jest.fn();
const getShareLinkInfo = jest.fn();
const generateAuthenticatedTransactionPdf = jest.fn();

jest.mock("../../init", () => ({
  auth: {},
  db: {
    collection: (name: string) => {
      if (name === "users") {
        return {
          doc: (uid: string) => ({
            get: async () => ({ exists: true, data: () => ({ tenantId: "t1", role: "MEMBER", masterId: "dono" }) }),
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
      if (name === "transactions") {
        return {
          doc: (id: string) => ({
            get: async () => ({ exists: !!transactions[id], data: () => transactions[id] }),
          }),
        };
      }
      throw new Error(`coleção inesperada: ${name}`);
    },
  },
}));

jest.mock("../services/shared-transactions.service", () => ({
  SharedTransactionService: {
    createShareLink: (...a: unknown[]) => createShareLink(...a),
    getShareLinkInfo: (...a: unknown[]) => getShareLinkInfo(...a),
  },
}));
jest.mock("../services/transaction-pdf.service", () => ({
  generateAuthenticatedTransactionPdf: (...a: unknown[]) => generateAuthenticatedTransactionPdf(...a),
}));
jest.mock("../../lib/tenant-capabilities", () => ({ tenantHasCapability: jest.fn() }));
jest.mock("../../lib/client-ip", () => ({ resolveClientIp: () => "200.1.2.3" }));

import { createShareLink as createShareLinkHandler, getShareLinkInfo as getShareLinkInfoHandler } from "./shared-transactions.controller";
import { downloadTransactionPdf } from "./transaction-pdf.controller";

function fakeRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
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
    setHeader() {},
  };
  return res as unknown as Response & { statusCode: number };
}

function fakeReq(role: string, uid = "u1") {
  return {
    params: { id: "tx1" },
    body: { expireDays: 30 },
    headers: {},
    user: { uid, tenantId: "t1", role, masterId: "dono", hasRequiredClaims: true },
  } as unknown as Request;
}

beforeEach(() => {
  jest.clearAllMocks();
  permissionDocs = {};
  transactions = { tx1: { tenantId: "t1", description: "Aluguel" } };
  createShareLink.mockResolvedValue({ shareUrl: "https://erp/share/transaction/tok" });
  getShareLinkInfo.mockResolvedValue({ exists: true });
  generateAuthenticatedTransactionPdf.mockResolvedValue({ buffer: Buffer.from("%PDF-"), transactionDescription: "Aluguel" });
});

const SELLER = { kanban: { canView: true }, proposals: { canView: true, canEdit: true } };

describe("POST /v1/transactions/:id/share-link", () => {
  it("vendedora sem Lançamentos leva 403 e o link nem é criado", async () => {
    permissionDocs = { u1: SELLER };
    const res = fakeRes();
    await createShareLinkHandler(fakeReq("MEMBER"), res);
    expect(res.statusCode).toBe(403);
    expect(createShareLink).not.toHaveBeenCalled();
  });

  it("quem só vê Lançamentos também não cria", async () => {
    permissionDocs = { u1: { transactions: { canView: true } } };
    const res = fakeRes();
    await createShareLinkHandler(fakeReq("MEMBER"), res);
    expect(res.statusCode).toBe(403);
  });

  it("quem edita Lançamentos cria", async () => {
    permissionDocs = { u1: { transactions: { canView: true, canEdit: true } } };
    const res = fakeRes();
    await createShareLinkHandler(fakeReq("MEMBER"), res);
    expect(res.statusCode).toBe(201);
    expect(createShareLink).toHaveBeenCalledWith("tx1", "t1", "u1", 30);
  });

  it("dono cria sem doc de permissão", async () => {
    const res = fakeRes();
    await createShareLinkHandler(fakeReq("MASTER", "dono"), res);
    expect(res.statusCode).toBe(201);
  });
});

describe("GET /v1/transactions/:id/share-link", () => {
  it("vendedora leva 403", async () => {
    permissionDocs = { u1: SELLER };
    const res = fakeRes();
    await getShareLinkInfoHandler(fakeReq("MEMBER"), res);
    expect(res.statusCode).toBe(403);
    expect(getShareLinkInfo).not.toHaveBeenCalled();
  });

  it("quem vê Lançamentos consulta", async () => {
    permissionDocs = { u1: { transactions: { canView: true } } };
    const res = fakeRes();
    await getShareLinkInfoHandler(fakeReq("MEMBER"), res);
    expect(res.statusCode).toBe(200);
  });
});

describe("GET /v1/transactions/:id/pdf", () => {
  it("vendedora leva 403 e o recibo nem é montado", async () => {
    permissionDocs = { u1: SELLER };
    const res = fakeRes();
    await downloadTransactionPdf(fakeReq("MEMBER"), res);
    expect(res.statusCode).toBe(403);
    expect(generateAuthenticatedTransactionPdf).not.toHaveBeenCalled();
  });

  it("quem vê Lançamentos baixa", async () => {
    permissionDocs = { u1: { transactions: { canView: true } } };
    const res = fakeRes();
    await downloadTransactionPdf(fakeReq("MEMBER"), res);
    expect(res.statusCode).toBe(200);
  });

  it("administrador baixa sem doc de permissão", async () => {
    const res = fakeRes();
    await downloadTransactionPdf(fakeReq("ADMIN", "dono"), res);
    expect(res.statusCode).toBe(200);
  });
});
