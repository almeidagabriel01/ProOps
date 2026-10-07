/**
 * Financeiro pelo WhatsApp.
 *
 * - O menu financeiro (resumo do dia, saldo, lançamentos, contas da semana)
 *   decidia pelo PAPEL: todo administrador passava e um membro com "Ver" em
 *   Lançamentos era barrado. Agora segue a permissão do ERP, a mesma que as
 *   rules exigem para ler o financeiro.
 * - "Enviar o link do lançamento" gerava o link público (que abre o Pix e o
 *   boleto) para qualquer número vinculado, e para qualquer id, sem conferir a
 *   empresa do lançamento. Agora exige editar Lançamentos e um lançamento da
 *   própria empresa.
 */

let permissionDocs: Record<string, Record<string, Record<string, unknown>>>;
let transactions: Record<string, Record<string, unknown>>;

const sendWhatsAppMessage = jest.fn();
const logAction = jest.fn();
const createShareLink = jest.fn();

jest.mock("../../../../init", () => ({
  auth: {},
  db: {
    collection: (name: string) => {
      if (name === "users") {
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

jest.mock("../whatsapp.api", () => ({
  sendWhatsAppMessage: (...a: unknown[]) => sendWhatsAppMessage(...a),
  sendWhatsAppInteractiveMessage: jest.fn(),
}));
jest.mock("../whatsapp.session", () => ({
  logAction: (...a: unknown[]) => logAction(...a),
  updateSession: jest.fn(),
}));
jest.mock("../whatsapp.db", () => ({
  queryProposalsForTenant: jest.fn(),
  getProposalByIdForTenant: jest.fn(),
  getTodaysTransactions: jest.fn(),
  getWalletSummary: jest.fn(),
  getRecentTransactions: jest.fn(),
  getWeeklyPendingTransactions: jest.fn(),
}));
jest.mock("../../shared-proposal.service", () => ({ SharedProposalService: {} }));
jest.mock("../../shared-transactions.service", () => ({
  SharedTransactionService: { createShareLink: (...a: unknown[]) => createShareLink(...a) },
}));

import { canAccessFinancialViaWhatsApp, handleSendTransactionLink } from "../whatsapp.flows";

const PHONE = "5511999990000";

beforeEach(() => {
  jest.clearAllMocks();
  permissionDocs = {
    vend: { kanban: { canView: true }, proposals: { canView: true } },
    fin: { transactions: { canView: true, canEdit: true } },
    finLe: { transactions: { canView: true, canEdit: false } },
    cart: { wallet: { canView: true } },
  };
  transactions = {
    tx1: { tenantId: "t1", description: "Aluguel" },
    txOutra: { tenantId: "t2", description: "De outra empresa" },
  };
  createShareLink.mockResolvedValue({ shareUrl: "https://erp/share/transaction/tok" });
});

describe("menu financeiro pelo WhatsApp", () => {
  it("vendedora sem Lançamentos nem Carteiras não acessa", async () => {
    await expect(canAccessFinancialViaWhatsApp("vend", "member")).resolves.toBe(false);
  });

  it("membro com 'Ver' em Lançamentos acessa (antes era barrado pelo papel)", async () => {
    await expect(canAccessFinancialViaWhatsApp("fin", "member")).resolves.toBe(true);
  });

  it("membro com 'Ver' em Carteiras acessa", async () => {
    await expect(canAccessFinancialViaWhatsApp("cart", "member")).resolves.toBe(true);
  });

  it.each(["admin", "master", "wk", "superadmin"])("%s acessa sem doc de permissão", async (role) => {
    await expect(canAccessFinancialViaWhatsApp("dono", role)).resolves.toBe(true);
  });
});

describe("link do lançamento pelo WhatsApp", () => {
  it("vendedora não gera o link", async () => {
    await handleSendTransactionLink(PHONE, "t1", "tx1", "vend", "member");
    expect(createShareLink).not.toHaveBeenCalled();
    expect(sendWhatsAppMessage).toHaveBeenCalledWith(PHONE, expect.stringContaining("permissão"));
  });

  it("quem só vê Lançamentos não gera o link", async () => {
    await handleSendTransactionLink(PHONE, "t1", "tx1", "finLe", "member");
    expect(createShareLink).not.toHaveBeenCalled();
  });

  it("quem edita Lançamentos gera o link do lançamento da empresa", async () => {
    await handleSendTransactionLink(PHONE, "t1", "tx1", "fin", "member");
    expect(createShareLink).toHaveBeenCalledWith("tx1", "t1", "fin");
    expect(sendWhatsAppMessage).toHaveBeenCalledWith(PHONE, expect.stringContaining("https://erp/share/transaction/tok"));
  });

  it("lançamento de outra empresa não gera link, nem para o dono", async () => {
    await handleSendTransactionLink(PHONE, "t1", "txOutra", "dono", "admin");
    await handleSendTransactionLink(PHONE, "t1", "naoExiste", "dono", "admin");
    expect(createShareLink).not.toHaveBeenCalled();
  });
});
