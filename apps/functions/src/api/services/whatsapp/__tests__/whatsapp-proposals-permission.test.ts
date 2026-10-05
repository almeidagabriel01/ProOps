/**
 * Pelo WhatsApp, "Ver propostas" lista as propostas com o valor de cada uma, e
 * escolher uma devolve o link da proposta inteira. Os dois respondiam a
 * qualquer número vinculado da empresa: o técnico de campo, sem a permissão de
 * ver propostas no ERP, recebia os preços pelo bot. Agora o membro precisa de
 * "Ver" em Propostas; dono e administradores passam direto.
 */

let permissionDocs: Record<string, Record<string, Record<string, unknown>>>;

const sendWhatsAppMessage = jest.fn();
const sendWhatsAppInteractiveMessage = jest.fn();
const logAction = jest.fn();
const updateSession = jest.fn();
const queryProposalsForTenant = jest.fn();
const getProposalByIdForTenant = jest.fn();
const createShareLink = jest.fn();

jest.mock("../../../../init", () => ({
  auth: {},
  db: {
    collection: (name: string) => {
      if (name !== "users") throw new Error(`coleção inesperada: ${name}`);
      return {
        doc: (uid: string) => ({
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
    },
  },
}));

jest.mock("../whatsapp.api", () => ({
  sendWhatsAppMessage: (...a: unknown[]) => sendWhatsAppMessage(...a),
  sendWhatsAppInteractiveMessage: (...a: unknown[]) => sendWhatsAppInteractiveMessage(...a),
}));
jest.mock("../whatsapp.session", () => ({
  logAction: (...a: unknown[]) => logAction(...a),
  updateSession: (...a: unknown[]) => updateSession(...a),
}));
jest.mock("../whatsapp.db", () => ({
  queryProposalsForTenant: (...a: unknown[]) => queryProposalsForTenant(...a),
  getProposalByIdForTenant: (...a: unknown[]) => getProposalByIdForTenant(...a),
  getTodaysTransactions: jest.fn(),
  getWalletSummary: jest.fn(),
  getRecentTransactions: jest.fn(),
  getWeeklyPendingTransactions: jest.fn(),
}));
jest.mock("../../shared-proposal.service", () => ({
  SharedProposalService: { createShareLink: (...a: unknown[]) => createShareLink(...a) },
}));
jest.mock("../../shared-transactions.service", () => ({ SharedTransactionService: {} }));

import { handleListProposals, handleSendPdf } from "../whatsapp.flows";

const PHONE = "5511999990000";

beforeEach(() => {
  jest.clearAllMocks();
  permissionDocs = {};
  queryProposalsForTenant.mockResolvedValue([
    { id: "prop1", title: "Casa", clientName: "Ana", totalValue: 18500 },
  ]);
  getProposalByIdForTenant.mockResolvedValue({ id: "prop1", title: "Casa" });
  createShareLink.mockResolvedValue({ shareUrl: "https://erp/share/tok" });
});

const TECHNICIAN = {
  service_orders: { canView: true, canEdit: true },
  equipment: { canView: true },
  calendar: { canView: true },
};

describe("Ver propostas pelo WhatsApp", () => {
  it("técnico (membro sem propostas) é recusado e nada é consultado", async () => {
    permissionDocs = { tec: TECHNICIAN };
    await handleListProposals(PHONE, "t1", "tec", "member");
    expect(queryProposalsForTenant).not.toHaveBeenCalled();
    expect(sendWhatsAppInteractiveMessage).not.toHaveBeenCalled();
    expect(sendWhatsAppMessage).toHaveBeenCalledWith(
      PHONE,
      "Você não tem permissão para ver propostas pelo WhatsApp.",
    );
    expect(logAction).toHaveBeenCalledWith(PHONE, "tec", "unauthorized_access_attempt", {
      target: "proposals",
    });
  });

  it("membro com 'Ver' em propostas recebe a lista", async () => {
    permissionDocs = { vend: { proposals: { canView: true } } };
    await handleListProposals(PHONE, "t1", "vend", "member");
    expect(queryProposalsForTenant).toHaveBeenCalled();
    expect(sendWhatsAppInteractiveMessage).toHaveBeenCalled();
  });

  it.each(["master", "admin", "wk"])("%s recebe a lista sem doc de permissão", async (role) => {
    await handleListProposals(PHONE, "t1", "dono", role);
    expect(sendWhatsAppInteractiveMessage).toHaveBeenCalled();
  });
});

describe("PDF da proposta pelo WhatsApp", () => {
  it("técnico não recebe o link, nem pelo id digitado", async () => {
    permissionDocs = { tec: TECHNICIAN };
    await handleSendPdf(PHONE, "t1", "prop1", "tec", "member");
    expect(getProposalByIdForTenant).not.toHaveBeenCalled();
    expect(createShareLink).not.toHaveBeenCalled();
  });

  it("membro só com o CRM também não recebe", async () => {
    permissionDocs = { crm: { kanban: { canView: true } } };
    await handleSendPdf(PHONE, "t1", "prop1", "crm", "member");
    expect(createShareLink).not.toHaveBeenCalled();
  });

  it("membro com 'Ver' em propostas recebe o link", async () => {
    permissionDocs = { vend: { proposals: { canView: true } } };
    await handleSendPdf(PHONE, "t1", "prop1", "vend", "member");
    expect(createShareLink).toHaveBeenCalledWith("prop1", "t1", "vend");
  });

  it("master recebe o link", async () => {
    await handleSendPdf(PHONE, "t1", "prop1", "dono", "master");
    expect(createShareLink).toHaveBeenCalled();
  });
});
