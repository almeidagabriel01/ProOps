/**
 * Aprovação online pelo link: o cliente final aprova, e a aprovação precisa
 * ter as MESMAS consequências da feita no ERP (lançamentos, nota automática,
 * Drive) e ficar registrada com quem aceitou.
 */

import type { Request, Response } from "express";

const mocks = {
  getSharedProposal: jest.fn(),
  tenantHasCapability: jest.fn(),
  isStatusApproved: jest.fn(),
  syncApprovedProposalTransactions: jest.fn(),
  createNotification: jest.fn(),
  isStatusDeliverableToDrive: jest.fn(),
  isDriveConnected: jest.fn(),
  enqueueDriveDelivery: jest.fn(),
  createShareLink: jest.fn(),
};

let proposalDoc: Record<string, unknown> | null;
let kanbanDocs: Array<{ id: string; data: Record<string, unknown> }>;
let tenantDoc: Record<string, unknown>;
let transactionDocs: Array<{ id: string; data: Record<string, unknown> }>;
const transactionUpdate = jest.fn();

jest.mock("../../init", () => {
  const proposalRef = {
    get: async () => ({ exists: proposalDoc !== null, data: () => proposalDoc }),
  };
  const query = (docs: () => Array<{ id: string; data: Record<string, unknown> }>) => {
    const q = {
      where: () => q,
      limit: () => q,
      get: async () => ({ docs: docs().map((d) => ({ id: d.id, data: () => d.data })) }),
    };
    return q;
  };
  return {
    db: {
      collection: (name: string) => {
        if (name === "proposals") return { doc: () => proposalRef };
        if (name === "kanban_statuses") return query(() => kanbanDocs);
        if (name === "transactions") return query(() => transactionDocs);
        if (name === "tenants") {
          return { doc: () => ({ get: async () => ({ data: () => tenantDoc }) }) };
        }
        throw new Error(`coleção inesperada: ${name}`);
      },
      runTransaction: async (fn: (t: unknown) => Promise<unknown>) =>
        fn({
          get: async () => ({ data: () => proposalDoc }),
          update: (_ref: unknown, data: Record<string, unknown>) => {
            transactionUpdate(data);
            proposalDoc = { ...proposalDoc, ...data };
          },
        }),
    },
  };
});

jest.mock("../services/shared-proposal.service", () => ({
  SharedProposalService: {
    getSharedProposal: (...a: unknown[]) => mocks.getSharedProposal(...a),
  },
}));
jest.mock("../../lib/tenant-capabilities", () => ({
  tenantHasCapability: (...a: unknown[]) => mocks.tenantHasCapability(...a),
}));
jest.mock("./proposals.controller", () => ({
  isStatusApproved: (...a: unknown[]) => mocks.isStatusApproved(...a),
  syncApprovedProposalTransactions: (...a: unknown[]) =>
    mocks.syncApprovedProposalTransactions(...a),
}));
jest.mock("../services/notification.service", () => ({
  NotificationService: {
    createNotification: (...a: unknown[]) => mocks.createNotification(...a),
  },
}));
jest.mock("../services/drive/proposal-drive-sync.service", () => ({
  isStatusDeliverableToDrive: (...a: unknown[]) => mocks.isStatusDeliverableToDrive(...a),
  isDriveConnected: (...a: unknown[]) => mocks.isDriveConnected(...a),
}));
jest.mock("../services/drive/drive-delivery-queue", () => ({
  enqueueDriveDelivery: (...a: unknown[]) => mocks.enqueueDriveDelivery(...a),
}));
jest.mock("../services/shared-transactions.service", () => ({
  SharedTransactionService: {
    createShareLink: (...a: unknown[]) => mocks.createShareLink(...a),
  },
}));
jest.mock("../../lib/client-ip", () => ({ resolveClientIp: () => "200.1.2.3" }));

import { approveSharedProposal } from "./proposal-online-approval.controller";

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

function fakeReq(body: unknown = VALID_BODY) {
  return {
    body,
    params: { token: "tok" },
    headers: { "user-agent": "Chrome" },
  } as unknown as Request;
}

const VALID_BODY = { name: "Maria Souza", document: "529.982.247-25", accepted: true };

beforeEach(() => {
  jest.clearAllMocks();
  proposalDoc = {
    tenantId: "t1",
    status: "sent",
    title: "Casa da Maria",
    validUntil: "2099-12-31",
  };
  kanbanDocs = [];
  tenantDoc = { asaasEnabled: true };
  transactionDocs = [];
  mocks.getSharedProposal.mockResolvedValue({
    id: "sp1",
    tenantId: "t1",
    proposalId: "p1",
    purpose: "external_share",
  });
  mocks.tenantHasCapability.mockResolvedValue(true);
  mocks.isStatusApproved.mockResolvedValue(false);
  mocks.syncApprovedProposalTransactions.mockResolvedValue(undefined);
  mocks.createNotification.mockResolvedValue(undefined);
  mocks.isStatusDeliverableToDrive.mockResolvedValue(true);
  mocks.isDriveConnected.mockResolvedValue(true);
  mocks.enqueueDriveDelivery.mockResolvedValue(undefined);
  mocks.createShareLink.mockResolvedValue({ shareUrl: "https://erp/share/transaction/x" });
});

describe("POST /v1/share/:token/approve", () => {
  it("aprova, grava o aceite e roda as consequências da aprovação", async () => {
    const res = fakeRes();
    await approveSharedProposal(fakeReq(), res);

    expect(res.statusCode).toBe(200);
    expect(transactionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "approved",
        clientAcceptance: expect.objectContaining({
          name: "Maria Souza",
          document: "52998224725",
          ip: "200.1.2.3",
          sharedProposalId: "sp1",
        }),
      }),
    );
    expect(mocks.syncApprovedProposalTransactions).toHaveBeenCalledWith(
      expect.objectContaining({
        proposalId: "p1",
        proposalTenantId: "t1",
        userId: "client_online_approval",
        initialStatus: "pending",
      }),
    );
    expect(mocks.enqueueDriveDelivery).toHaveBeenCalledWith({ tenantId: "t1", proposalId: "p1" });
    expect(mocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "t1", type: "proposal_approved", proposalId: "p1" }),
    );
  });

  it("empresa com funil personalizado: grava o status da coluna ganha", async () => {
    kanbanDocs = [{ id: "col-fechado", data: { order: 3, category: "won" } }];
    const res = fakeRes();
    await approveSharedProposal(fakeReq(), res);

    expect(transactionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "col-fechado" }),
    );
  });

  it("devolve o link de pagamento do sinal quando a empresa recebe online", async () => {
    transactionDocs = [
      { id: "tx-parcela", data: { type: "income", status: "pending", dueDate: "2026-11-01" } },
      { id: "tx-sinal", data: { type: "income", status: "pending", isDownPayment: true } },
      { id: "tx-comissao", data: { type: "expense", isCommission: true } },
    ];
    const res = fakeRes();
    await approveSharedProposal(fakeReq(), res);

    expect(mocks.createShareLink).toHaveBeenCalledWith("tx-sinal", "t1", "client_online_approval");
    expect(res.body.paymentUrl).toBe("https://erp/share/transaction/x");
  });

  it("sem pagamento online no plano não gera link", async () => {
    mocks.tenantHasCapability.mockImplementation(async (_t: string, cap: string) => cap !== "onlinePayments");
    transactionDocs = [{ id: "tx-sinal", data: { type: "income", isDownPayment: true } }];
    const res = fakeRes();
    await approveSharedProposal(fakeReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.paymentUrl).toBeNull();
    expect(mocks.createShareLink).not.toHaveBeenCalled();
  });

  it("plano sem aprovação online (Starter) recusa com 403 e não grava nada", async () => {
    mocks.tenantHasCapability.mockResolvedValue(false);
    const res = fakeRes();
    await approveSharedProposal(fakeReq(), res);

    expect(res.statusCode).toBe(403);
    expect(transactionUpdate).not.toHaveBeenCalled();
    expect(mocks.syncApprovedProposalTransactions).not.toHaveBeenCalled();
  });

  it("proposta já aprovada responde 409 sem gerar lançamentos de novo", async () => {
    mocks.isStatusApproved.mockResolvedValue(true);
    const res = fakeRes();
    await approveSharedProposal(fakeReq(), res);

    expect(res.statusCode).toBe(409);
    expect(mocks.syncApprovedProposalTransactions).not.toHaveBeenCalled();
  });

  it("proposta vencida responde 410", async () => {
    proposalDoc = { ...proposalDoc, validUntil: "2020-01-01" };
    const res = fakeRes();
    await approveSharedProposal(fakeReq(), res);

    expect(res.statusCode).toBe(410);
    expect(transactionUpdate).not.toHaveBeenCalled();
  });

  it("rascunho não pode ser aprovado pelo link", async () => {
    proposalDoc = { ...proposalDoc, status: "draft" };
    const res = fakeRes();
    await approveSharedProposal(fakeReq(), res);

    expect(res.statusCode).toBe(409);
    expect(transactionUpdate).not.toHaveBeenCalled();
  });

  it("dados inválidos respondem 400 antes de ler qualquer coisa", async () => {
    const res = fakeRes();
    await approveSharedProposal(fakeReq({ ...VALID_BODY, document: "123" }), res);

    expect(res.statusCode).toBe(400);
    expect(mocks.getSharedProposal).not.toHaveBeenCalled();
  });

  it("link interno de render do PDF não aprova", async () => {
    mocks.getSharedProposal.mockResolvedValue({
      id: "sp1",
      tenantId: "t1",
      proposalId: "p1",
      purpose: "system_pdf_render",
    });
    const res = fakeRes();
    await approveSharedProposal(fakeReq(), res);

    expect(res.statusCode).toBe(404);
  });

  it("proposta de outra empresa responde 404", async () => {
    proposalDoc = { ...proposalDoc, tenantId: "outro" };
    const res = fakeRes();
    await approveSharedProposal(fakeReq(), res);

    expect(res.statusCode).toBe(404);
    expect(transactionUpdate).not.toHaveBeenCalled();
  });

  it("falha nos lançamentos: aceite fica gravado e a empresa é avisada", async () => {
    mocks.syncApprovedProposalTransactions.mockRejectedValue(new Error("boom"));
    const res = fakeRes();
    await approveSharedProposal(fakeReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.paymentUrl).toBeNull();
    expect(mocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("os lançamentos não foram gerados"),
      }),
    );
  });
});
