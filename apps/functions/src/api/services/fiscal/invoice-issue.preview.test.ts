/**
 * O convite ao aprovar a proposta só aparece quando a nota REALMENTE pode sair.
 *
 * Convidar para depois mostrar uma checklist de pendências é pior que não
 * convidar: transforma um atalho em armadilha. Por isso o preview responde a
 * mesma coisa que a emissão responderia — reaproveitando `assembleInvoices` —
 * sem despachar nada.
 */

const assembleInvoices = jest.fn();
const getFiscalSettings = jest.fn();
const listInvoicesByProposal = jest.fn();
const getProposal = jest.fn();

jest.mock("../../../init", () => ({
  db: { collection: () => ({ doc: () => ({ get: getProposal }) }) },
}));
jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("./fiscal-settings.service", () => ({ getFiscalSettings }));
jest.mock("./invoice-assembly.service", () => ({ assembleInvoices }));
jest.mock("./invoice.service", () => ({
  listInvoicesByProposal,
  createInvoice: jest.fn(),
  issueInvoice: jest.fn(),
}));

import { previewFromProposal } from "./invoice-issue.service";

const READY = { status: "ready" };

function mockProposal(doc: Record<string, unknown> | null) {
  getProposal.mockResolvedValue({
    exists: doc !== null,
    data: () => doc ?? undefined,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  getFiscalSettings.mockResolvedValue(READY);
  mockProposal({ tenantId: "t1", clientId: "c1", products: [] });
  listInvoicesByProposal.mockResolvedValue([]);
  assembleInvoices.mockResolvedValue({
    invoices: [{ type: "nfe", valorTotal: 100 }],
    gaps: [],
  });
});

describe("previewFromProposal", () => {
  it("libera quando está pronto e sem lacunas", async () => {
    const preview = await previewFromProposal("t1", "p1");

    expect(preview.canIssue).toBe(true);
    expect(preview.documentos).toEqual([{ type: "nfe", valorTotal: 100 }]);
    expect(preview.reason).toBeUndefined();
  });

  it("conta as duas notas de uma venda mista", async () => {
    assembleInvoices.mockResolvedValue({
      invoices: [
        { type: "nfe", valorTotal: 100 },
        { type: "nfse", valorTotal: 50 },
      ],
      gaps: [],
    });

    const preview = await previewFromProposal("t1", "p1");

    expect(preview.canIssue).toBe(true);
    expect(preview.documentos).toHaveLength(2);
  });

  it("nega com as lacunas quando falta dado fiscal", async () => {
    assembleInvoices.mockResolvedValue({
      invoices: [{ type: "nfe", valorTotal: 100 }],
      gaps: [{ scope: "produto", field: "ncm", message: "Informe o NCM" }],
    });

    const preview = await previewFromProposal("t1", "p1");

    expect(preview.canIssue).toBe(false);
    expect(preview.reason).toBe("FISCAL_INCOMPLETO");
    expect(preview.gaps).toHaveLength(1);
  });

  it("nega antes da primeira nota autorizada", async () => {
    // `registered` significa cadastrado no provedor, mas sem prova de
    // credenciamento na SEFAZ — emitir daria rejeição.
    getFiscalSettings.mockResolvedValue({ status: "registered" });

    const preview = await previewFromProposal("t1", "p1");

    expect(preview.canIssue).toBe(false);
    expect(preview.reason).toBe("FISCAL_NAO_PRONTO");
    expect(assembleInvoices).not.toHaveBeenCalled();
  });

  it("nega quando o fiscal nem foi configurado, sem tocar na proposta", async () => {
    getFiscalSettings.mockResolvedValue(null);

    const preview = await previewFromProposal("t1", "p1");

    expect(preview.canIssue).toBe(false);
    expect(preview.reason).toBe("FISCAL_NAO_CONFIGURADO");
    expect(getProposal).not.toHaveBeenCalled();
  });

  it("nega proposta sem cliente", async () => {
    mockProposal({ tenantId: "t1", products: [] });

    const preview = await previewFromProposal("t1", "p1");

    expect(preview.canIssue).toBe(false);
    expect(preview.reason).toBe("PROPOSTA_SEM_CLIENTE");
  });

  it("nega proposta de outro tenant", async () => {
    mockProposal({ tenantId: "outro", clientId: "c1", products: [] });

    await expect(previewFromProposal("t1", "p1")).rejects.toThrow(
      "FORBIDDEN_TENANT_MISMATCH",
    );
  });

  it("relata nota autorizada que já veio desta proposta", async () => {
    listInvoicesByProposal.mockResolvedValue([
      { id: "i1", type: "nfe", status: "authorized", numero: "12", serie: "1" },
    ]);

    const preview = await previewFromProposal("t1", "p1");

    expect(preview.jaEmitidas).toEqual([
      { id: "i1", type: "nfe", status: "authorized", numero: "12", serie: "1" },
    ]);
    // Continua podendo emitir: quem decide duplicar é o usuário, avisado.
    expect(preview.canIssue).toBe(true);
  });

  it("relata nota em processamento — pode estar a segundos de ser autorizada", async () => {
    listInvoicesByProposal.mockResolvedValue([
      { id: "i1", type: "nfe", status: "processing" },
    ]);

    const preview = await previewFromProposal("t1", "p1");

    expect(preview.jaEmitidas).toHaveLength(1);
  });

  it("ignora rejeitada, cancelada e com erro", async () => {
    // Reemitir depois de rejeição foi o caminho normal a semana inteira;
    // avisar ali seria só atrito sobre documento que não existe.
    listInvoicesByProposal.mockResolvedValue([
      { id: "i1", type: "nfe", status: "rejected" },
      { id: "i2", type: "nfe", status: "cancelled" },
      { id: "i3", type: "nfe", status: "error" },
      { id: "i4", type: "nfe", status: "draft" },
    ]);

    const preview = await previewFromProposal("t1", "p1");

    expect(preview.jaEmitidas).toEqual([]);
  });

  it("não emite nada — é só consulta", async () => {
    const { createInvoice, issueInvoice } = jest.requireMock("./invoice.service");

    await previewFromProposal("t1", "p1");

    expect(createInvoice).not.toHaveBeenCalled();
    expect(issueInvoice).not.toHaveBeenCalled();
  });
});
