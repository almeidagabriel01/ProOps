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

const tenantHasCapability = jest.fn();
jest.mock("../../../lib/tenant-capabilities", () => ({
  tenantHasCapability: (...args: unknown[]) =>
    tenantHasCapability(...(args as [])),
}));

import {
  isDriveConnected,
  isStatusDeliverableToDrive,
  shouldSuggestDriveConnection,
  syncProposalToDrive,
} from "./proposal-drive-sync.service";

const PROPOSTA = { clientId: "c1", title: "Automação", proposalCode: "0018926SP" };

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
  tenantHasCapability.mockResolvedValue(true);
});

/**
 * Estas duas decidem, no salvamento da proposta, entre enfileirar uma entrega e
 * convidar o usuario a conectar o Drive.
 *
 * A armadilha e a condicao DIVERGIR da que o `syncProposalToDrive` usa para
 * devolver `skipped: "sem_integracao"`: mais frouxa aqui cria job para ser
 * descartado; mais rigida deixa de entregar proposta aprovada.
 */
describe("isDriveConnected", () => {
  it("e verdadeiro com token e pasta raiz", async () => {
    await expect(isDriveConnected("t1")).resolves.toBe(true);
  });

  it("e falso sem integracao nenhuma", async () => {
    getDriveIntegration.mockResolvedValue(null);
    await expect(isDriveConnected("t1")).resolves.toBe(false);
  });

  it("e falso com token e sem pasta raiz", async () => {
    // Desconectar preserva a pasta e apaga o token; o documento sobrevive.
    getDriveIntegration.mockResolvedValue({ refreshTokenEnc: "enc:token" });
    await expect(isDriveConnected("t1")).resolves.toBe(false);
  });

  it("e falso com pasta raiz e sem token", async () => {
    getDriveIntegration.mockResolvedValue({ rootFolderId: "raiz-1" });
    await expect(isDriveConnected("t1")).resolves.toBe(false);
  });

  it("falha de leitura responde verdadeiro, para nao perder a entrega", async () => {
    getDriveIntegration.mockRejectedValue(new Error("firestore fora do ar"));
    await expect(isDriveConnected("t1")).resolves.toBe(true);
  });
});

describe("shouldSuggestDriveConnection", () => {
  it("convida quem tem o plano e nao conectou", async () => {
    getDriveIntegration.mockResolvedValue(null);
    await expect(shouldSuggestDriveConnection("t1")).resolves.toBe(true);
  });

  it("nao convida quem ja conectou", async () => {
    await expect(shouldSuggestDriveConnection("t1")).resolves.toBe(false);
  });

  it("nao convida plano sem a integracao, e nem le a integracao", async () => {
    // Convite a cada aprovacao para quem nao pode conectar e upsell no meio do
    // trabalho, nao aviso.
    tenantHasCapability.mockResolvedValue(false);
    await expect(shouldSuggestDriveConnection("t1")).resolves.toBe(false);
    expect(getDriveIntegration).not.toHaveBeenCalled();
  });

  it("nao convida quando a checagem falha", async () => {
    // Um aviso a menos nao quebra nada; uma excecao derrubaria o salvamento.
    tenantHasCapability.mockRejectedValue(new Error("cache fora do ar"));
    await expect(shouldSuggestDriveConnection("t1")).resolves.toBe(false);
  });

  it("pergunta pela capacidade certa", async () => {
    getDriveIntegration.mockResolvedValue(null);
    await shouldSuggestDriveConnection("t1");
    expect(tenantHasCapability).toHaveBeenCalledWith("t1", "driveSync");
  });
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
        fileName: "0018926SP - Automação.pdf",
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

    // Nao lanca, mas DEVOLVE a falha. Enquanto devolvia `undefined`, a fila
    // lia "nao lancou" como "entregue": o retry existia e nunca disparava, e o
    // operador via sucesso sobre uma entrega que nao aconteceu.
    await expect(
      syncProposalToDrive({
        tenantId: "t1",
        proposalId: "p1",
        proposalData: PROPOSTA,
      }),
    ).resolves.toEqual({
      status: "failed",
      error: "quota do Drive excedida",
    });

    // E deixa rastro nos dois lugares: log e o proprio documento.
    expect(error).toHaveBeenCalled();
    expect(proposalUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ driveSyncError: "quota do Drive excedida" }),
    );
  });
});
