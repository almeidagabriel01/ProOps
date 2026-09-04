/**
 * O gatilho da entrega no Drive.
 *
 * O erro mais caro aqui nao e falhar — e disparar cedo demais. O PDF da
 * proposta e gerado SOB DEMANDA, toda vez que alguem abre para conferir; se a
 * entrega acontecesse "ao gerar", a pasta do cliente acumularia versoes de
 * rascunho e deixaria de ser a fonte limpa que a integracao promete.
 *
 * O segundo erro caro seria LANCAR: a mudanca de status ja aconteceu quando
 * isto roda, e uma venda nao pode ser desfeita porque o Google recusou um
 * upload.
 */

const statusGet = jest.fn();
const proposalUpdate = jest.fn();
const getDriveIntegration = jest.fn();
const uploadProposalPdf = jest.fn();
const getOrGenerateProposalPdfBuffer = jest.fn();
const error = jest.fn();

jest.mock("../../../init", () => ({
  db: {
    collection: (nome: string) => ({
      doc: () =>
        nome === "kanban_statuses"
          ? { get: statusGet }
          : { update: proposalUpdate },
    }),
  },
}));
jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error },
}));
jest.mock("./drive-oauth.service", () => ({ getDriveIntegration }));
jest.mock("./drive.service", () => ({
  uploadProposalPdf,
  buildProposalFileName: (n: unknown, t: string) => `${n ?? ""} - ${t}.pdf`,
}));
jest.mock("../proposal-pdf.service", () => ({ getOrGenerateProposalPdfBuffer }));

import {
  isStatusDeliverableToDrive,
  syncProposalToDrive,
} from "./proposal-drive-sync.service";

const PROPOSTA = { clientId: "c1", title: "Automação", proposalNumber: 12 };

beforeEach(() => {
  jest.clearAllMocks();
  proposalUpdate.mockResolvedValue(undefined);
  getDriveIntegration.mockResolvedValue({
    refreshTokenEnc: "enc:token",
    rootFolderId: "raiz-1",
  });
  getOrGenerateProposalPdfBuffer.mockResolvedValue(Buffer.from("%PDF"));
  uploadProposalPdf.mockResolvedValue({ fileId: "arq-1" });
  statusGet.mockResolvedValue({ exists: false });
});

describe("isStatusDeliverableToDrive", () => {
  it("entrega em Enviada e em Aprovada", async () => {
    for (const status of ["sent", "default_1", "approved", "default_2"]) {
      expect(await isStatusDeliverableToDrive(status, "t1")).toBe(true);
    }
  });

  it("NAO entrega enquanto e rascunho", async () => {
    // O caso que protege a pasta do cliente de virar deposito de rascunho.
    for (const status of ["draft", "in_progress", "default_0"]) {
      expect(await isStatusDeliverableToDrive(status, "t1")).toBe(false);
    }
  });

  it("nao entrega proposta recusada", async () => {
    expect(await isStatusDeliverableToDrive("rejected", "t1")).toBe(false);
    expect(await isStatusDeliverableToDrive("default_3", "t1")).toBe(false);
  });

  it("respeita a coluna que o tenant RENOMEOU", async () => {
    // O rotulo varia por empresa; o que vale e o mapeamento da coluna.
    statusGet.mockResolvedValue({
      exists: true,
      data: () => ({ tenantId: "t1", mappedStatus: "sent", label: "No cliente" }),
    });

    expect(await isStatusDeliverableToDrive("col-abc", "t1")).toBe(true);
  });

  it("ignora coluna de OUTRO tenant", async () => {
    statusGet.mockResolvedValue({
      exists: true,
      data: () => ({ tenantId: "t2", mappedStatus: "sent" }),
    });

    expect(await isStatusDeliverableToDrive("col-abc", "t1")).toBe(false);
  });

  it("aceita categoria 'won' de modelos mais novos", async () => {
    statusGet.mockResolvedValue({
      exists: true,
      data: () => ({ tenantId: "t1", category: "won" }),
    });

    expect(await isStatusDeliverableToDrive("col-abc", "t1")).toBe(true);
  });
});

describe("syncProposalToDrive", () => {
  it("sobe o PDF para a pasta do cliente", async () => {
    await syncProposalToDrive({
      tenantId: "t1",
      proposalId: "p1",
      proposalData: PROPOSTA,
    });

    expect(uploadProposalPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        proposalId: "p1",
        clientId: "c1",
        fileName: "12 - Automação.pdf",
      }),
    );
  });

  it("sai calado quando o tenant nao ligou o Drive", async () => {
    // E o caso NORMAL: a maioria nunca vai conectar, e tratar isso como erro
    // encheria o log de ruido.
    getDriveIntegration.mockResolvedValue(null);

    await syncProposalToDrive({
      tenantId: "t1",
      proposalId: "p1",
      proposalData: PROPOSTA,
    });

    expect(getOrGenerateProposalPdfBuffer).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("sai calado quando a conta foi DESCONECTADA", async () => {
    // O documento sobrevive ao desconectar para preservar a pasta — checar so
    // a pasta geraria um PDF a toa (Chromium, o recurso mais caro do backend)
    // para falhar logo depois.
    getDriveIntegration.mockResolvedValue({
      rootFolderId: "raiz-1",
      refreshTokenEnc: undefined,
    });

    await syncProposalToDrive({
      tenantId: "t1",
      proposalId: "p1",
      proposalData: PROPOSTA,
    });

    expect(getOrGenerateProposalPdfBuffer).not.toHaveBeenCalled();
  });

  it("sai calado quando a pasta raiz ainda nao foi escolhida", async () => {
    getDriveIntegration.mockResolvedValue({
      refreshTokenEnc: "enc:token",
      rootFolderId: null,
    });

    await syncProposalToDrive({
      tenantId: "t1",
      proposalId: "p1",
      proposalData: PROPOSTA,
    });

    expect(uploadProposalPdf).not.toHaveBeenCalled();
  });

  it("nao gera PDF de proposta sem cliente", async () => {
    // Sem cliente nao ha pasta de destino — e gerar o PDF a toa custa
    // Chromium, que e o recurso mais caro do backend.
    await syncProposalToDrive({
      tenantId: "t1",
      proposalId: "p1",
      proposalData: { title: "Sem cliente" },
    });

    expect(getOrGenerateProposalPdfBuffer).not.toHaveBeenCalled();
  });

  it("NUNCA lanca — a venda nao pode ser desfeita por falha de upload", async () => {
    uploadProposalPdf.mockRejectedValue(new Error("quota do Drive excedida"));

    await expect(
      syncProposalToDrive({
        tenantId: "t1",
        proposalId: "p1",
        proposalData: PROPOSTA,
      }),
    ).resolves.toBeUndefined();

    // Mas deixa rastro nos dois lugares: log e o proprio documento.
    expect(error).toHaveBeenCalled();
    expect(proposalUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ driveSyncError: "quota do Drive excedida" }),
    );
  });
});
