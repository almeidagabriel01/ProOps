/**
 * Aceite online pelo link: o cliente aceita, o aceite fica PENDENTE e a
 * empresa é avisada. Nada de status, lançamento, Drive ou cobrança até alguém
 * da equipe confirmar. E a empresa pode descartar o aceite para ajustar.
 */

import type { Request, Response } from "express";

const mocks = {
  getSharedProposal: jest.fn(),
  tenantHasCapability: jest.fn(),
  isStatusApproved: jest.fn(),
  createNotification: jest.fn(),
  hasPagePermission: jest.fn(),
};

let proposalDoc: Record<string, unknown> | null;
let tenantDoc: Record<string, unknown>;
let transactionDocs: Array<{ id: string; data: Record<string, unknown> }>;
const transactionUpdate = jest.fn();
const createShareLink = jest.fn();

jest.mock("../../init", () => {
  const proposalRef = {
    get: async () => ({ exists: proposalDoc !== null, data: () => proposalDoc }),
  };
  return {
    db: {
      collection: (name: string) => {
        if (name === "proposals") return { doc: () => proposalRef };
        if (name === "tenants") {
          return { doc: () => ({ get: async () => ({ data: () => tenantDoc }) }) };
        }
        if (name === "transactions") {
          const q = {
            where: () => q,
            limit: () => q,
            get: async () => ({
              docs: transactionDocs.map((d) => ({ id: d.id, data: () => d.data })),
            }),
          };
          return q;
        }
        throw new Error(`coleção inesperada: ${name}`);
      },
      runTransaction: async (fn: (t: unknown) => Promise<unknown>) =>
        fn({
          get: async () => ({ exists: proposalDoc !== null, data: () => proposalDoc }),
          update: (_ref: unknown, data: Record<string, unknown>) => {
            transactionUpdate(data);
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
jest.mock("../../lib/auth-helpers", () => ({
  hasPagePermission: (...a: unknown[]) => mocks.hasPagePermission(...a),
}));
jest.mock("./proposals.controller", () => ({
  isStatusApproved: (...a: unknown[]) => mocks.isStatusApproved(...a),
}));
jest.mock("../services/notification.service", () => ({
  NotificationService: {
    createNotification: (...a: unknown[]) => mocks.createNotification(...a),
  },
}));
jest.mock("../../lib/client-ip", () => ({ resolveClientIp: () => "200.1.2.3" }));
jest.mock("../services/shared-transactions.service", () => ({
  SharedTransactionService: {
    createShareLink: (...a: unknown[]) => createShareLink(...a),
  },
}));

import {
  acceptSharedProposal,
  createSharedProposalPaymentLink,
  discardClientAcceptance,
  requestSharedProposalChanges,
  resolveClientChangeRequest,
  resolveOnlineApprovalState,
} from "./proposal-online-approval.controller";
import { proposalContentHash } from "../services/proposal-online-approval";

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

function erpReq(id = "p1") {
  return {
    params: { id },
    user: { uid: "u1", tenantId: "t1", role: "MEMBER" },
  } as unknown as Request;
}

const VALID_BODY = { name: "Maria Souza", document: "529.982.247-25", accepted: true };
const BASE = { tenantId: "t1", status: "sent", title: "Casa da Maria", validUntil: "2099-12-31", totalValue: 1000 };

function pendingAcceptance(over: Record<string, unknown> = {}) {
  return {
    name: "Maria Souza",
    acceptedAt: "2026-09-26T10:00:00.000Z",
    status: "pending",
    contentHash: proposalContentHash(BASE),
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  proposalDoc = { ...BASE };
  tenantDoc = { asaasEnabled: true };
  transactionDocs = [];
  createShareLink.mockResolvedValue({ shareUrl: "https://erp/share/transaction/x" });
  mocks.getSharedProposal.mockResolvedValue({
    id: "sp1",
    tenantId: "t1",
    proposalId: "p1",
    purpose: "external_share",
  });
  mocks.tenantHasCapability.mockResolvedValue(true);
  mocks.isStatusApproved.mockResolvedValue(false);
  mocks.createNotification.mockResolvedValue(undefined);
  mocks.hasPagePermission.mockResolvedValue(true);
});

describe("POST /v1/share/:token/accept", () => {
  it("grava o aceite PENDENTE, sem mudar o status, e avisa a empresa", async () => {
    const res = fakeRes();
    await acceptSharedProposal(fakeReq(), res);

    expect(res.statusCode).toBe(200);
    const written = transactionUpdate.mock.calls[0][0];
    expect(written).not.toHaveProperty("status");
    expect(written.clientAcceptance).toMatchObject({
      name: "Maria Souza",
      document: "52998224725",
      ip: "200.1.2.3",
      sharedProposalId: "sp1",
      status: "pending",
      contentHash: proposalContentHash(BASE),
    });
    expect(mocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "t1", type: "proposal_accepted", proposalId: "p1" }),
    );
  });

  it("aceite já pendente responde 409 sem gravar outro", async () => {
    proposalDoc = { ...BASE, clientAcceptance: pendingAcceptance() };
    const res = fakeRes();
    await acceptSharedProposal(fakeReq(), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe("ALREADY_ACCEPTED");
    expect(transactionUpdate).not.toHaveBeenCalled();
  });

  it("depois de descartado, o cliente aceita de novo e o anterior vira histórico", async () => {
    proposalDoc = { ...BASE, clientAcceptance: pendingAcceptance({ status: "discarded" }) };
    const res = fakeRes();
    await acceptSharedProposal(fakeReq(), res);

    expect(res.statusCode).toBe(200);
    const written = transactionUpdate.mock.calls[0][0];
    expect(written.clientAcceptance.status).toBe("pending");
    expect(written).toHaveProperty("clientAcceptanceHistory");
  });

  it("plano sem aceite online (Starter) recusa com 403", async () => {
    mocks.tenantHasCapability.mockResolvedValue(false);
    const res = fakeRes();
    await acceptSharedProposal(fakeReq(), res);

    expect(res.statusCode).toBe(403);
    expect(transactionUpdate).not.toHaveBeenCalled();
  });

  it("proposta já aprovada responde 409", async () => {
    mocks.isStatusApproved.mockResolvedValue(true);
    const res = fakeRes();
    await acceptSharedProposal(fakeReq(), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe("ALREADY_APPROVED");
  });

  it("proposta vencida responde 410", async () => {
    proposalDoc = { ...BASE, validUntil: "2020-01-01" };
    const res = fakeRes();
    await acceptSharedProposal(fakeReq(), res);

    expect(res.statusCode).toBe(410);
    expect(transactionUpdate).not.toHaveBeenCalled();
  });

  it("rascunho não pode ser aceito", async () => {
    proposalDoc = { ...BASE, status: "draft" };
    const res = fakeRes();
    await acceptSharedProposal(fakeReq(), res);

    expect(res.statusCode).toBe(409);
    expect(transactionUpdate).not.toHaveBeenCalled();
  });

  it("dados inválidos respondem 400 antes de ler qualquer coisa", async () => {
    const res = fakeRes();
    await acceptSharedProposal(fakeReq({ ...VALID_BODY, document: "123" }), res);

    expect(res.statusCode).toBe(400);
    expect(mocks.getSharedProposal).not.toHaveBeenCalled();
  });

  it("link interno de render do PDF não aceita", async () => {
    mocks.getSharedProposal.mockResolvedValue({
      id: "sp1",
      tenantId: "t1",
      proposalId: "p1",
      purpose: "system_pdf_render",
    });
    const res = fakeRes();
    await acceptSharedProposal(fakeReq(), res);

    expect(res.statusCode).toBe(404);
  });

  it("proposta de outra empresa responde 404", async () => {
    proposalDoc = { ...BASE, tenantId: "outro" };
    const res = fakeRes();
    await acceptSharedProposal(fakeReq(), res);

    expect(res.statusCode).toBe(404);
    expect(transactionUpdate).not.toHaveBeenCalled();
  });
});

describe("resolveOnlineApprovalState", () => {
  it("aceite pendente: sem formulário, aguardando a empresa", async () => {
    const state = await resolveOnlineApprovalState("t1", { ...BASE, clientAcceptance: pendingAcceptance() });
    expect(state).toMatchObject({
      canApprove: false,
      awaitingConfirmation: true,
      acceptance: { name: "Maria Souza" },
    });
  });

  it("aceite descartado ou anulado: o formulário volta e o aceite antigo não aparece", async () => {
    for (const status of ["discarded", "invalidated"]) {
      const state = await resolveOnlineApprovalState("t1", {
        ...BASE,
        clientAcceptance: pendingAcceptance({ status }),
      });
      expect(state).toMatchObject({ canApprove: true, awaitingConfirmation: false, acceptance: null });
    }
  });

  it("aprovada pela empresa: nem formulário nem espera", async () => {
    mocks.isStatusApproved.mockResolvedValue(true);
    const state = await resolveOnlineApprovalState("t1", {
      ...BASE,
      clientAcceptance: pendingAcceptance({ status: "confirmed" }),
    });
    expect(state).toMatchObject({ canApprove: false, approved: true, awaitingConfirmation: false });
  });
});

describe("POST /v1/proposals/:id/acceptance/discard", () => {
  it("descarta o aceite pendente, registrando quem e quando", async () => {
    proposalDoc = { ...BASE, clientAcceptance: pendingAcceptance() };
    const res = fakeRes();
    await discardClientAcceptance(erpReq(), res);

    expect(res.statusCode).toBe(200);
    expect(transactionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        "clientAcceptance.status": "discarded",
        "clientAcceptance.resolvedBy": "u1",
      }),
    );
  });

  it("sem permissão de editar propostas: 403", async () => {
    mocks.hasPagePermission.mockResolvedValue(false);
    proposalDoc = { ...BASE, clientAcceptance: pendingAcceptance() };
    const res = fakeRes();
    await discardClientAcceptance(erpReq(), res);

    expect(res.statusCode).toBe(403);
    expect(mocks.hasPagePermission).toHaveBeenCalledWith(expect.anything(), "proposals", "canEdit");
    expect(transactionUpdate).not.toHaveBeenCalled();
  });

  it("proposta de outra empresa: 404", async () => {
    proposalDoc = { ...BASE, tenantId: "outro", clientAcceptance: pendingAcceptance() };
    const res = fakeRes();
    await discardClientAcceptance(erpReq(), res);

    expect(res.statusCode).toBe(404);
  });

  it("sem aceite pendente: 409", async () => {
    proposalDoc = { ...BASE, clientAcceptance: pendingAcceptance({ status: "confirmed" }) };
    const res = fakeRes();
    await discardClientAcceptance(erpReq(), res);

    expect(res.statusCode).toBe(409);
    expect(transactionUpdate).not.toHaveBeenCalled();
  });
});

const CHANGE_BODY = { name: "Maria", message: "O prazo combinado era de 30 dias, não 45." };

function openRequest(over: Record<string, unknown> = {}) {
  return {
    message: "Faltou a cortina da sala",
    requestedAt: "2026-09-26T10:00:00.000Z",
    status: "open",
    contentHash: proposalContentHash(BASE),
    ...over,
  };
}

describe("POST /v1/share/:token/request-changes", () => {
  it("grava o pedido aberto com a justificativa e avisa a empresa", async () => {
    const res = fakeRes();
    await requestSharedProposalChanges(fakeReq(CHANGE_BODY), res);

    expect(res.statusCode).toBe(200);
    const written = transactionUpdate.mock.calls[0][0];
    expect(written).not.toHaveProperty("status");
    expect(written.clientChangeRequest).toMatchObject({
      name: "Maria",
      message: CHANGE_BODY.message,
      status: "open",
      ip: "200.1.2.3",
      contentHash: proposalContentHash(BASE),
    });
    expect(mocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "proposal_changes_requested",
        proposalId: "p1",
        message: expect.stringContaining("O prazo combinado"),
      }),
    );
  });

  it("sem justificativa suficiente: 400 antes de ler qualquer coisa", async () => {
    const res = fakeRes();
    await requestSharedProposalChanges(fakeReq({ message: "não" }), res);
    expect(res.statusCode).toBe(400);
    expect(mocks.getSharedProposal).not.toHaveBeenCalled();
  });

  it("pedido já aberto: 409 sem gravar outro", async () => {
    proposalDoc = { ...BASE, clientChangeRequest: openRequest() };
    const res = fakeRes();
    await requestSharedProposalChanges(fakeReq(CHANGE_BODY), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe("CHANGES_ALREADY_REQUESTED");
    expect(transactionUpdate).not.toHaveBeenCalled();
  });

  it("pedido anterior resolvido vira histórico", async () => {
    proposalDoc = { ...BASE, clientChangeRequest: openRequest({ status: "resolved" }) };
    const res = fakeRes();
    await requestSharedProposalChanges(fakeReq(CHANGE_BODY), res);
    expect(res.statusCode).toBe(200);
    expect(transactionUpdate.mock.calls[0][0]).toHaveProperty("clientChangeRequestHistory");
  });

  it("aprovada, com aceite pendente ou vencida: 409", async () => {
    mocks.isStatusApproved.mockResolvedValue(true);
    let res = fakeRes();
    await requestSharedProposalChanges(fakeReq(CHANGE_BODY), res);
    expect(res.statusCode).toBe(409);

    mocks.isStatusApproved.mockResolvedValue(false);
    proposalDoc = { ...BASE, clientAcceptance: pendingAcceptance() };
    res = fakeRes();
    await requestSharedProposalChanges(fakeReq(CHANGE_BODY), res);
    expect(res.statusCode).toBe(409);

    proposalDoc = { ...BASE, validUntil: "2020-01-01" };
    res = fakeRes();
    await requestSharedProposalChanges(fakeReq(CHANGE_BODY), res);
    expect(res.statusCode).toBe(409);
    expect(transactionUpdate).not.toHaveBeenCalled();
  });

  it("plano sem aceite online: 403", async () => {
    mocks.tenantHasCapability.mockResolvedValue(false);
    const res = fakeRes();
    await requestSharedProposalChanges(fakeReq(CHANGE_BODY), res);
    expect(res.statusCode).toBe(403);
  });
});

describe("estado do link: pedido de mudanças e pagamento", () => {
  it("pedido aberto: sem novo pedido, mas o aceite continua possível", async () => {
    const state = await resolveOnlineApprovalState("t1", { ...BASE, clientChangeRequest: openRequest() }, "p1");
    expect(state).toMatchObject({
      canApprove: true,
      canRequestChanges: false,
      changeRequest: { requestedAt: "2026-09-26T10:00:00.000Z" },
    });
  });

  it("devolve o histórico de pedidos ao cliente, sem IP", async () => {
    const state = await resolveOnlineApprovalState(
      "t1",
      {
        ...BASE,
        clientChangeRequest: openRequest({ ip: "200.1.2.3", name: "Maria" }),
        clientChangeRequestHistory: [
          openRequest({
            requestedAt: "2026-09-20T10:00:00.000Z",
            message: "Trocar o motor",
            status: "resolved",
            resolvedAt: "2026-09-21T10:00:00.000Z",
            resolvedBy: "uid-equipe",
          }),
        ],
      },
      "p1",
    );
    expect(state.changeRequests).toEqual([
      { name: "Maria", message: "Faltou a cortina da sala", requestedAt: "2026-09-26T10:00:00.000Z", status: "open", resolvedAt: null },
      { name: null, message: "Trocar o motor", requestedAt: "2026-09-20T10:00:00.000Z", status: "resolved", resolvedAt: "2026-09-21T10:00:00.000Z" },
    ]);
    expect(JSON.stringify(state)).not.toContain("200.1.2.3");
    expect(JSON.stringify(state)).not.toContain("uid-equipe");
  });

  it("sem pedido: histórico vazio", async () => {
    expect((await resolveOnlineApprovalState("t1", BASE, "p1")).changeRequests).toEqual([]);
  });

  it("aprovada com entrada em aberto e pagamento online: botão de pagar a entrada", async () => {
    mocks.isStatusApproved.mockResolvedValue(true);
    transactionDocs = [
      { id: "tx-entrada", data: { type: "income", status: "pending", isDownPayment: true } },
    ];
    const state = await resolveOnlineApprovalState("t1", { ...BASE, status: "approved" }, "p1");
    expect(state.payment).toEqual({ label: "Pagar entrada" });
  });

  it("sem Asaas ligado ou sem o add-on: sem botão de pagar", async () => {
    mocks.isStatusApproved.mockResolvedValue(true);
    transactionDocs = [{ id: "tx", data: { type: "income", status: "pending" } }];
    tenantDoc = { asaasEnabled: false };
    expect((await resolveOnlineApprovalState("t1", BASE, "p1")).payment).toBeNull();

    tenantDoc = { asaasEnabled: true };
    mocks.tenantHasCapability.mockImplementation(async (_t: string, cap: string) => cap !== "onlinePayments");
    expect((await resolveOnlineApprovalState("t1", BASE, "p1")).payment).toBeNull();
  });

  it("ainda não aprovada: nunca mostra pagamento", async () => {
    transactionDocs = [{ id: "tx", data: { type: "income", status: "pending", isDownPayment: true } }];
    expect((await resolveOnlineApprovalState("t1", BASE, "p1")).payment).toBeNull();
  });
});

describe("POST /v1/share/:token/payment-link", () => {
  it("proposta aprovada: devolve o link do lançamento a pagar", async () => {
    mocks.isStatusApproved.mockResolvedValue(true);
    transactionDocs = [
      { id: "tx-parcela", data: { type: "income", status: "pending", dueDate: "2026-11-01" } },
    ];
    const res = fakeRes();
    await createSharedProposalPaymentLink(fakeReq({}), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.url).toBe("https://erp/share/transaction/x");
    expect(createShareLink).toHaveBeenCalledWith("tx-parcela", "t1", "client_online_approval");
  });

  it("ainda não aprovada: 409 e nenhum link", async () => {
    const res = fakeRes();
    await createSharedProposalPaymentLink(fakeReq({}), res);
    expect(res.statusCode).toBe(409);
    expect(createShareLink).not.toHaveBeenCalled();
  });

  it("nada em aberto: 404", async () => {
    mocks.isStatusApproved.mockResolvedValue(true);
    transactionDocs = [{ id: "tx", data: { type: "income", status: "paid" } }];
    const res = fakeRes();
    await createSharedProposalPaymentLink(fakeReq({}), res);
    expect(res.statusCode).toBe(404);
  });
});

describe("POST /v1/proposals/:id/change-request/resolve", () => {
  it("encerra o pedido aberto registrando quem", async () => {
    proposalDoc = { ...BASE, clientChangeRequest: openRequest() };
    const res = fakeRes();
    await resolveClientChangeRequest(erpReq(), res);
    expect(res.statusCode).toBe(200);
    expect(transactionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        "clientChangeRequest.status": "resolved",
        "clientChangeRequest.resolvedBy": "u1",
      }),
    );
  });

  it("sem permissão de editar propostas: 403", async () => {
    mocks.hasPagePermission.mockResolvedValue(false);
    proposalDoc = { ...BASE, clientChangeRequest: openRequest() };
    const res = fakeRes();
    await resolveClientChangeRequest(erpReq(), res);
    expect(res.statusCode).toBe(403);
  });

  it("de outra empresa: 404; sem pedido aberto: 409", async () => {
    proposalDoc = { ...BASE, tenantId: "outro", clientChangeRequest: openRequest() };
    let res = fakeRes();
    await resolveClientChangeRequest(erpReq(), res);
    expect(res.statusCode).toBe(404);

    proposalDoc = { ...BASE, clientChangeRequest: openRequest({ status: "resolved" }) };
    res = fakeRes();
    await resolveClientChangeRequest(erpReq(), res);
    expect(res.statusCode).toBe(409);
  });
});

