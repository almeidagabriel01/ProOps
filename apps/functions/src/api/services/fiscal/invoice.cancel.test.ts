/**
 * Cancelamento recusado tem que FALHAR, não passar em silêncio.
 *
 * O caso real: uma NF-e autorizada em 28/08 foi "cancelada" em 31/08 — fora do
 * prazo de 24h. O provedor respondeu **200** com `erro_cancelamento`, o
 * mapeamento levou a `error`, `canApplyStatus` bloqueou a transição (autorizada
 * não regride), nada mudou no documento, o backend devolveu 200 e a UI mostrou
 * "Nota cancelada" sobre uma nota que continuava valendo perante o fisco.
 *
 * Toast de sucesso numa operação que falhou é pior que erro nenhum: o usuário
 * para de procurar.
 */

const cancel = jest.fn();
const getDoc = jest.fn();

jest.mock("../../../init", () => ({
  db: { collection: () => ({ doc: () => ({ get: getDoc }) }) },
}));
jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("./fiscal-settings.service", () => ({
  getIssuingToken: jest.fn(async () => "token-empresa"),
  setFiscalStatus: jest.fn(),
}));
jest.mock("./fiscal-provider.registry", () => ({
  getFiscalProvider: () => ({ cancel }),
  resolveFiscalEnvironment: () => "homologacao",
}));
jest.mock("./invoice-archive.service", () => ({
  archiveInvoiceDocuments: jest.fn(),
}));

import { cancelInvoice } from "./invoice.service";

const AUTHORIZED = {
  id: "inv-1",
  tenantId: "tenant-1",
  provider: "focus",
  ref: "ref-1",
  type: "nfe",
  status: "authorized",
  environment: "homologacao",
};

function mockInvoice(doc: Record<string, unknown> | null) {
  getDoc.mockResolvedValue({
    exists: doc !== null,
    id: "inv-1",
    data: () => doc ?? undefined,
  });
}

describe("cancelInvoice", () => {
  beforeEach(() => {
    cancel.mockReset();
    getDoc.mockReset();
    mockInvoice(AUTHORIZED);
  });

  it("lança com a mensagem do fisco quando o cancelamento é recusado", async () => {
    // Fora do prazo é a recusa mais comum, e o provedor devolve 200.
    cancel.mockResolvedValue({
      ref: "ref-1",
      type: "nfe",
      status: "error",
      rejectionCode: "573",
      rejectionMessage: "Rejeicao: Prazo de cancelamento superior ao previsto",
    });

    await expect(cancelInvoice("inv-1", "justificativa suficiente")).rejects.toThrow(
      "Prazo de cancelamento superior ao previsto",
    );
  });

  it("lança mesmo sem mensagem, em vez de dar por cancelada", async () => {
    cancel.mockResolvedValue({ ref: "ref-1", type: "nfe", status: "error" });

    await expect(cancelInvoice("inv-1", "justificativa suficiente")).rejects.toThrow(
      "CANCELAMENTO_RECUSADO",
    );
  });

  it("recusa cancelar o que não está autorizado", async () => {
    // Rejeitada ou em processamento não tem o que cancelar — e chamar o
    // provedor gastaria uma requisição para receber a mesma negativa.
    mockInvoice({ ...AUTHORIZED, status: "rejected" });

    await expect(cancelInvoice("inv-1", "justificativa suficiente")).rejects.toThrow(
      "INVOICE_NAO_AUTORIZADA",
    );
    expect(cancel).not.toHaveBeenCalled();
  });

  it("falha quando a nota não existe", async () => {
    mockInvoice(null);

    await expect(cancelInvoice("inv-1", "justificativa suficiente")).rejects.toThrow(
      "INVOICE_NOT_FOUND",
    );
  });
});
