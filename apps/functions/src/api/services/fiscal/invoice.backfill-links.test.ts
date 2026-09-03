/**
 * Nota já autorizada precisa poder RECEBER um link que faltava.
 *
 * `canApplyStatus` existe contra regressão de status, mas barrava junto o
 * preenchimento de campo ausente: consultar uma nota autorizada devolve
 * `authorized` de novo, a transição é recusada e o update inteiro — links
 * inclusive — era descartado. As NFS-e emitidas antes de `url_danfse` ser
 * mapeado ficaram sem PDF, e nenhum botão da UI as recuperava.
 *
 * Link de documento não regride: ou falta, ou existe e é imutável.
 */

const get = jest.fn();
const update = jest.fn();
const archiveInvoiceDocuments = jest.fn();

jest.mock("../../../init", () => ({
  db: {
    collection: () => ({ doc: () => ({ get, update }) }),
    runTransaction: async (fn: (t: unknown) => unknown) =>
      fn({ get, update }),
  },
}));
jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("./invoice-archive.service", () => ({ archiveInvoiceDocuments }));
jest.mock("./fiscal-settings.service", () => ({
  getIssuingToken: jest.fn(),
  setFiscalStatus: jest.fn(),
}));
jest.mock("./fiscal-provider.registry", () => ({
  getFiscalProvider: jest.fn(),
  resolveFiscalEnvironment: () => "producao",
}));

import { applyInvoiceResult } from "./invoice.service";

const AUTORIZADA = {
  id: "inv-1",
  tenantId: "t1",
  status: "authorized",
  type: "nfse",
  xmlUrl: "https://x/nota.xml",
};

function mockInvoice(doc: Record<string, unknown>) {
  get.mockResolvedValue({ exists: true, id: "inv-1", data: () => doc });
}

const RESULTADO = {
  ref: "r1",
  type: "nfse" as const,
  status: "authorized" as const,
  pdfUrl: "https://s3/DANFSEs/nota.pdf",
  xmlUrl: "https://x/nota.xml",
};

beforeEach(() => {
  jest.clearAllMocks();
  update.mockResolvedValue(undefined);
});

describe("applyInvoiceResult — links que chegam depois", () => {
  it("preenche o pdfUrl que faltava numa nota já autorizada", async () => {
    mockInvoice(AUTORIZADA);

    const outcome = await applyInvoiceResult("inv-1", RESULTADO);

    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][1]).toMatchObject({
      pdfUrl: "https://s3/DANFSEs/nota.pdf",
    });
    // `applied` para que o arquivamento rode agora que o arquivo existe.
    expect(outcome).toEqual({ applied: true, status: "authorized" });
  });

  it("arquiva o documento que acabou de aparecer", async () => {
    mockInvoice(AUTORIZADA);

    await applyInvoiceResult("inv-1", RESULTADO);

    expect(archiveInvoiceDocuments).toHaveBeenCalled();
  });

  it("não mexe num link que já existe — documento fiscal é imutável", async () => {
    mockInvoice({ ...AUTORIZADA, pdfUrl: "https://s3/original.pdf" });

    const outcome = await applyInvoiceResult("inv-1", RESULTADO);

    expect(update).not.toHaveBeenCalled();
    expect(outcome.applied).toBe(false);
  });

  it("não ressuscita status: cancelada continua cancelada", async () => {
    // A guarda original segue valendo — o que mudou é só o preenchimento de
    // campo ausente, nunca a transição de estado.
    mockInvoice({ ...AUTORIZADA, status: "cancelled", pdfUrl: "https://s3/o.pdf" });

    const outcome = await applyInvoiceResult("inv-1", RESULTADO);

    expect(outcome.status).toBe("cancelled");
    expect(update).not.toHaveBeenCalled();
  });

  it("preenche o link mas preserva o status terminal", async () => {
    mockInvoice({ ...AUTORIZADA, status: "cancelled" });

    const outcome = await applyInvoiceResult("inv-1", RESULTADO);

    expect(update.mock.calls[0][1]).toMatchObject({
      pdfUrl: "https://s3/DANFSEs/nota.pdf",
    });
    expect(update.mock.calls[0][1]).not.toHaveProperty("status");
    expect(outcome.status).toBe("cancelled");
  });
});
