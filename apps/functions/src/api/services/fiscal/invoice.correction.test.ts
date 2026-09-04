/**
 * Carta de correcao: registrar o que o fisco NAO aceitou e o pior desfecho.
 *
 * O provedor responde **200 mesmo quando o fisco recusa** — foi assim que o
 * cancelamento chegou a mostrar "cancelada" sobre uma nota que seguia valendo.
 * Na CC-e o estrago e maior, porque ela e CUMULATIVA: uma carta fantasma no
 * historico e repetida pela proxima correcao, e o usuario segue achando que
 * corrigiu algo que a SEFAZ nunca registrou.
 *
 * A checagem e por PROVA DE FALHA, nao por prova de sucesso: exigir um status
 * especifico recusaria toda correcao caso o provedor devolva a resposta num
 * formato que ainda nao vimos.
 */

const get = jest.fn();
const update = jest.fn();
const correct = jest.fn();
const archiveCorrectionDocuments = jest.fn();
const warn = jest.fn();

jest.mock("../../../init", () => ({
  db: { collection: () => ({ doc: () => ({ get, update }) }) },
}));
jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), warn, error: jest.fn() },
}));
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { arrayUnion: (v: unknown) => ({ __arrayUnion: v }) },
}));
jest.mock("./invoice-archive.service", () => ({
  archiveCorrectionDocuments,
  archiveInvoiceDocuments: jest.fn(),
}));
jest.mock("./fiscal-settings.service", () => ({
  getIssuingToken: jest.fn(async () => "token-da-empresa"),
  setFiscalStatus: jest.fn(),
}));
jest.mock("./fiscal-provider.registry", () => ({
  getFiscalProvider: () => ({ correct }),
  resolveFiscalEnvironment: () => "producao",
}));

import { correctInvoice } from "./invoice.service";

const NOTA = {
  id: "inv-1",
  tenantId: "t1",
  ref: "r1",
  type: "nfe",
  status: "authorized",
  numero: "12",
  provider: "focus",
};

function mockNota(doc: Record<string, unknown> = {}) {
  get.mockResolvedValue({
    exists: true,
    id: "inv-1",
    data: () => ({ ...NOTA, ...doc }),
  });
}

/** O objeto que foi para `correcoes` via arrayUnion. */
function correcaoGravada(): Record<string, unknown> {
  const payload = update.mock.calls[0]?.[0] as Record<string, unknown>;
  return (payload?.correcoes as { __arrayUnion: Record<string, unknown> })
    ?.__arrayUnion;
}

const OK = { ref: "r1", type: "nfe" as const, status: "authorized" as const };

beforeEach(() => {
  jest.clearAllMocks();
  update.mockResolvedValue(undefined);
  archiveCorrectionDocuments.mockResolvedValue({});
  correct.mockResolvedValue(OK);
});

describe("correctInvoice — recusa do fisco", () => {
  it("LANCA quando o provedor devolve recusa em resposta de sucesso", async () => {
    mockNota();
    correct.mockResolvedValue({
      ...OK,
      status: "error",
      rejectionCode: "594",
      rejectionMessage: "Rejeicao 594: sequencia da carta de correcao",
    });

    await expect(correctInvoice("inv-1", "texto da correcao")).rejects.toThrow(
      /594/,
    );
    // E nada foi gravado: carta fantasma e o desfecho que se quer evitar.
    expect(update).not.toHaveBeenCalled();
  });

  it("LANCA quando o status volta como rejeitado, mesmo sem mensagem", async () => {
    mockNota();
    correct.mockResolvedValue({ ...OK, status: "rejected" });

    await expect(correctInvoice("inv-1", "texto da correcao")).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });

  it("SEGUE com status desconhecido, mas deixa registro", async () => {
    // Exigir prova de sucesso recusaria toda correcao se o provedor mudasse o
    // formato da resposta. A duvida vira log, nao um caminho quebrado.
    mockNota();
    correct.mockResolvedValue({ ...OK, status: "processing" });

    await correctInvoice("inv-1", "texto da correcao");

    expect(update).toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      "Carta de correção com status inesperado",
      expect.objectContaining({ status: "processing" }),
    );
  });
});

describe("correctInvoice — documento do evento", () => {
  it("arquiva o XML e o PDF da carta", async () => {
    // A copia no nosso Storage e o que sustenta a guarda legal de 5 anos: o
    // link do provedor e publico hoje, mas e acervo de terceiro.
    mockNota();
    correct.mockResolvedValue({
      ...OK,
      correcaoXmlUrl: "https://api/cce.xml",
      correcaoPdfUrl: "https://api/cce.pdf",
      correcaoNumero: "1",
    });
    archiveCorrectionDocuments.mockResolvedValue({
      storageXmlPath: "tenants/t1/fiscal/inv-1/cce-1.xml",
      storagePdfPath: "tenants/t1/fiscal/inv-1/cce-1.pdf",
    });

    await correctInvoice("inv-1", "texto da correcao");

    expect(archiveCorrectionDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ id: "inv-1" }),
      1,
      { xmlUrl: "https://api/cce.xml", pdfUrl: "https://api/cce.pdf" },
    );
    expect(correcaoGravada()).toMatchObject({
      numero: "1",
      storageXmlPath: "tenants/t1/fiscal/inv-1/cce-1.xml",
      storagePdfPath: "tenants/t1/fiscal/inv-1/cce-1.pdf",
    });
  });

  it("numera a carta pela posicao no historico", async () => {
    // Cada CC-e e um evento distinto, com guarda propria — a terceira nao pode
    // sobrescrever o arquivo da segunda.
    mockNota({
      correcoes: [
        { texto: "primeira", registradaEm: "2026-09-01" },
        { texto: "segunda", registradaEm: "2026-09-02" },
      ],
    });
    correct.mockResolvedValue({ ...OK, correcaoXmlUrl: "https://api/cce.xml" });

    await correctInvoice("inv-1", "terceira correcao");

    expect(archiveCorrectionDocuments).toHaveBeenCalledWith(
      expect.anything(),
      3,
      expect.anything(),
    );
  });

  it("registra a correcao mesmo sem documento, e avisa", async () => {
    // O evento existe na SEFAZ de qualquer jeito. Perder a copia nao pode
    // desfazer a correcao — mas tem que ficar visivel que ela faltou.
    mockNota();
    correct.mockResolvedValue(OK);

    await correctInvoice("inv-1", "texto da correcao");

    expect(correcaoGravada()).toMatchObject({ texto: "texto da correcao" });
    expect(warn).toHaveBeenCalledWith(
      "Carta de correção sem documento no retorno do provedor",
      expect.objectContaining({ invoiceId: "inv-1" }),
    );
  });
});
