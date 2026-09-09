/**
 * Duas armadilhas do escopo `drive.file`, e as duas produzem bagunca em vez de
 * erro — ninguem descobre por uma excecao, so olhando o Drive dias depois:
 *
 * 1. **Nao conseguimos LISTAR o que nao criamos.** Se o id da pasta do cliente
 *    nao ficar gravado, a proxima proposta cria outra pasta com o mesmo nome.
 * 2. **Um arquivo por proposta.** Subir um arquivo novo a cada envio encheria
 *    a pasta de versoes e destruiria justamente a organizacao que a integracao
 *    promete entregar.
 */

const clientGet = jest.fn();
const clientUpdate = jest.fn();
const proposalGet = jest.fn();
const proposalUpdate = jest.fn();
const filesCreate = jest.fn();
const filesUpdate = jest.fn();
const filesList = jest.fn();
const filesGet = jest.fn();
const getDriveClient = jest.fn();

jest.mock("../../../init", () => ({
  db: {
    collection: (nome: string) => ({
      doc: () =>
        nome === "clients"
          ? { get: clientGet, update: clientUpdate }
          : { get: proposalGet, update: proposalUpdate },
    }),
  },
}));
jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("./drive-oauth.service", () => ({ getDriveClient }));

import {
  buildClientFolderName,
  buildProposalFileName,
  createRootFolder,
  DEFAULT_ROOT_FOLDER_NAME,
  ensureClientFolder,
  uploadProposalPdf,
} from "./drive.service";

function mockCliente(doc: Record<string, unknown> | null) {
  clientGet.mockResolvedValue({
    exists: doc !== null,
    data: () => doc ?? undefined,
  });
}

function mockDrive(rootFolderId: string | null = "raiz-1") {
  getDriveClient.mockResolvedValue({
    client: {
      files: {
        create: filesCreate,
        update: filesUpdate,
        list: filesList,
        get: filesGet,
      },
    },
    integration: { rootFolderId },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  clientUpdate.mockResolvedValue(undefined);
  proposalUpdate.mockResolvedValue(undefined);
  proposalGet.mockResolvedValue({ data: () => ({}) });
  filesCreate.mockResolvedValue({ data: { id: "novo-1", webViewLink: "https://d/1" } });
  filesUpdate.mockResolvedValue({ data: { id: "arq-1", webViewLink: "https://d/1" } });
  filesList.mockResolvedValue({ data: { files: [] } });
  filesGet.mockResolvedValue({ data: { id: "pasta-9", trashed: false } });
  filesCreate.mockResolvedValue({ data: { id: "novo-1", webViewLink: "https://d/1" } });
  mockDrive();
});

describe("ensureClientFolder", () => {
  it("REUSA a pasta ja gravada em vez de criar outra", async () => {
    // O teste que mais importa: sem o id gravado nao ha como reencontrar a
    // pasta, e cada proposta criaria uma duplicata com o mesmo nome.
    mockCliente({ tenantId: "t1", name: "Jose", driveFolderId: "pasta-9" });

    expect(await ensureClientFolder("t1", "c1")).toBe("pasta-9");
    expect(filesCreate).not.toHaveBeenCalled();
  });

  it("RECRIA quando a pasta gravada foi apagada no Drive", async () => {
    // O usuario apaga pasta no Drive, inclusive sem querer. Sem conferir,
    // "Pasta no Drive" abriria um link morto e a proxima proposta tentaria
    // subir para um pai inexistente.
    mockCliente({ tenantId: "t1", name: "Jose", driveFolderId: "sumiu" });
    filesGet.mockRejectedValue(new Error("File not found: sumiu"));
    filesCreate.mockResolvedValue({ data: { id: "pasta-recriada" } });

    expect(await ensureClientFolder("t1", "c1")).toBe("pasta-recriada");
    expect(clientUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ driveFolderId: "pasta-recriada" }),
    );
  });

  it("RECRIA quando a pasta foi para a lixeira", async () => {
    // Lixeira nao e "apagada": a API responde normalmente, com trashed=true, e
    // criar dentro dela nao daria erro — a proposta simplesmente sumiria.
    mockCliente({ tenantId: "t1", name: "Jose", driveFolderId: "na-lixeira" });
    filesGet.mockResolvedValue({ data: { id: "na-lixeira", trashed: true } });
    filesCreate.mockResolvedValue({ data: { id: "pasta-recriada" } });

    expect(await ensureClientFolder("t1", "c1")).toBe("pasta-recriada");
  });

  it("cria a pasta dentro da raiz e grava o id no contato", async () => {
    mockCliente({ tenantId: "t1", name: "Jose Francisco" });
    filesCreate.mockResolvedValue({ data: { id: "pasta-nova" } });

    expect(await ensureClientFolder("t1", "c1")).toBe("pasta-nova");
    expect(filesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          name: "Jose Francisco",
          parents: ["raiz-1"],
        }),
        // Sem isto, criar dentro de um Drive compartilhado falha — e Drive
        // compartilhado e a recomendacao para quem tem equipe.
        supportsAllDrives: true,
      }),
    );
    expect(clientUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ driveFolderId: "pasta-nova" }),
    );
  });

  it("recusa contato de OUTRO tenant", async () => {
    mockCliente({ tenantId: "t2", name: "Jose" });

    await expect(ensureClientFolder("t1", "c1")).rejects.toThrow(
      "CLIENTE_DE_OUTRO_TENANT",
    );
  });

  it("exige a pasta raiz antes de criar qualquer coisa", async () => {
    // Conectar a conta nao basta: sem a raiz nao sabemos ONDE criar, e criar
    // no "Meu Drive" espalharia pasta solta na conta do cliente.
    mockCliente({ tenantId: "t1", name: "Jose" });
    mockDrive(null);

    await expect(ensureClientFolder("t1", "c1")).rejects.toThrow(
      "DRIVE_SEM_PASTA_RAIZ",
    );
  });

  it("falha quando o provedor nao confirma o id", async () => {
    mockCliente({ tenantId: "t1", name: "Jose" });
    filesCreate.mockResolvedValue({ data: {} });

    await expect(ensureClientFolder("t1", "c1")).rejects.toThrow(
      "DRIVE_FALHA_AO_CRIAR_PASTA",
    );
  });
});

describe("createRootFolder", () => {
  it("cria na raiz do Meu Drive, sem pai", async () => {
    // Sem `parents` a pasta nasce na raiz, de onde o usuario move para dentro
    // da estrutura que ja tem — o acesso segue o ARQUIVO, nao o caminho.
    mockDrive(null);
    filesCreate.mockResolvedValue({ data: { id: "raiz-nova" } });

    const r = await createRootFolder("t1");

    expect(r).toEqual({
      folderId: "raiz-nova",
      folderName: DEFAULT_ROOT_FOLDER_NAME,
    });
    const args = filesCreate.mock.calls[0][0];
    expect(args.requestBody).not.toHaveProperty("parents");
  });

  it("e IDEMPOTENTE: nao cria uma segunda raiz", async () => {
    // Dois cliques no botao nao podem produzir duas pastas soltas no Drive de
    // alguem.
    mockDrive("raiz-existente");

    const r = await createRootFolder("t1");

    expect(filesCreate).not.toHaveBeenCalled();
    expect(r.folderId).toBe("raiz-existente");
  });

  it("RECRIA quando a raiz gravada foi apagada no Drive", async () => {
    // Sem esta conferencia, apagar a raiz no Drive deixava o sistema apontando
    // para ela para sempre — e as pastas de cliente passariam a ser criadas
    // dentro de um pai na lixeira.
    mockDrive("raiz-apagada");
    filesGet.mockRejectedValue(new Error("File not found"));
    filesCreate.mockResolvedValue({ data: { id: "raiz-nova" } });

    const r = await createRootFolder("t1");

    expect(r.folderId).toBe("raiz-nova");
  });

  it("REAPROVEITA a pasta antiga depois de desconectar e reconectar", async () => {
    // Desconectar apaga o documento inteiro da integracao, `rootFolderId`
    // inclusive — sem consultar o Drive, reconectar criava uma segunda
    // "ProOps - Propostas" ao lado da primeira. Aconteceu no teste real.
    mockDrive(null);
    filesList.mockResolvedValue({
      data: { files: [{ id: "raiz-antiga", name: "Propostas do Zé" }] },
    });

    const r = await createRootFolder("t1");

    expect(filesCreate).not.toHaveBeenCalled();
    // E preserva o nome que o usuario deu, se ele renomeou.
    expect(r).toEqual({ folderId: "raiz-antiga", folderName: "Propostas do Zé" });
  });

  it("procura pela MARCA, nao pelo nome", async () => {
    // O usuario pode renomear a pasta a vontade — casar por nome perderia ela.
    mockDrive(null);

    await createRootFolder("t1");

    const q = String(filesList.mock.calls[0][0].q);
    expect(q).toContain("proopsRoot");
    expect(q).not.toContain(DEFAULT_ROOT_FOLDER_NAME);
  });

  it("marca a pasta criada para ser reencontravel depois", async () => {
    mockDrive(null);

    await createRootFolder("t1");

    expect(filesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          appProperties: { proopsRoot: "1" },
        }),
      }),
    );
  });

  it("cria quando a consulta falha — nao pode travar a configuracao", async () => {
    mockDrive(null);
    filesList.mockRejectedValue(new Error("backend error"));
    filesCreate.mockResolvedValue({ data: { id: "raiz-nova" } });

    const r = await createRootFolder("t1");

    expect(r.folderId).toBe("raiz-nova");
  });

  it("nao usa caractere fora do ASCII no nome", () => {
    // A pasta e sincronizada para Windows e macOS por quem usa o Drive de
    // desktop, e caractere exotico e fonte classica de arquivo que nao desce.
    expect(DEFAULT_ROOT_FOLDER_NAME).toMatch(/^[ -~]+$/);
  });
});

describe("uploadProposalPdf", () => {
  const params = {
    tenantId: "t1",
    proposalId: "p1",
    clientId: "c1",
    fileName: "12 - Proposta.pdf",
    pdf: Buffer.from("%PDF-1.4"),
  };

  it("ATUALIZA o arquivo que ja existe em vez de criar outro", async () => {
    mockCliente({ tenantId: "t1", name: "Jose", driveFolderId: "pasta-9" });
    proposalGet.mockResolvedValue({ data: () => ({ driveFileId: "arq-1" }) });

    const r = await uploadProposalPdf(params);

    expect(filesUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ fileId: "arq-1" }),
    );
    expect(filesCreate).not.toHaveBeenCalled();
    expect(r.fileId).toBe("arq-1");
  });

  it("cria na primeira vez e grava o id na proposta", async () => {
    mockCliente({ tenantId: "t1", name: "Jose", driveFolderId: "pasta-9" });

    await uploadProposalPdf(params);

    expect(filesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          name: "12 - Proposta.pdf",
          parents: ["pasta-9"],
        }),
      }),
    );
    expect(proposalUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ driveFileId: "novo-1" }),
    );
  });

  it("ACHA o arquivo pelo proposalId quando o campo nao foi gravado", async () => {
    // A duplicata real veio daqui: duas chamadas simultaneas leram
    // `driveFileId` vazio e as duas criaram, deixando dois PDFs identicos na
    // pasta do cliente sem erro em lugar nenhum.
    mockCliente({ tenantId: "t1", name: "Jose", driveFolderId: "pasta-9" });
    proposalGet.mockResolvedValue({ data: () => ({}) });
    filesList.mockResolvedValue({ data: { files: [{ id: "ja-existia" }] } });
    // O Drive devolve o id do arquivo que foi atualizado.
    filesUpdate.mockResolvedValue({ data: { id: "ja-existia" } });

    const r = await uploadProposalPdf(params);

    expect(filesCreate).not.toHaveBeenCalled();
    expect(filesUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ fileId: "ja-existia" }),
    );
    expect(r.fileId).toBe("ja-existia");
  });

  it("procura pelo proposalId, nao pelo nome", async () => {
    // Duas propostas do mesmo cliente podem ter o mesmo titulo — casar por
    // nome faria uma sobrescrever a outra.
    mockCliente({ tenantId: "t1", name: "Jose", driveFolderId: "pasta-9" });

    await uploadProposalPdf(params);

    const q = String(filesList.mock.calls[0][0].q);
    expect(q).toContain("value='p1'");
    expect(q).not.toContain(params.fileName);
  });

  it("marca o arquivo criado com o proposalId", async () => {
    mockCliente({ tenantId: "t1", name: "Jose", driveFolderId: "pasta-9" });

    await uploadProposalPdf(params);

    expect(filesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          appProperties: { proposalId: "p1" },
        }),
      }),
    );
  });

  it("entrega mesmo se a consulta de duplicata falhar", async () => {
    // Perder a consulta nao pode impedir a entrega — no pior caso volta a
    // depender so do campo gravado, que era o comportamento anterior.
    mockCliente({ tenantId: "t1", name: "Jose", driveFolderId: "pasta-9" });
    filesList.mockRejectedValue(new Error("backend error"));

    const r = await uploadProposalPdf(params);

    expect(r.fileId).toBe("novo-1");
  });

  it("RECRIA quando o arquivo foi apagado no Drive", async () => {
    // Apagar o arquivo la nao pode deixar a proposta permanentemente sem
    // entrega — o update falha com 404 e o caminho util e criar de novo.
    mockCliente({ tenantId: "t1", name: "Jose", driveFolderId: "pasta-9" });
    proposalGet.mockResolvedValue({ data: () => ({ driveFileId: "sumiu" }) });
    filesUpdate.mockRejectedValue(new Error("File not found: sumiu"));

    const r = await uploadProposalPdf(params);

    expect(filesCreate).toHaveBeenCalled();
    expect(r.fileId).toBe("novo-1");
  });
});

describe("nomes", () => {
  it("troca caracteres que quebram a sincronia com Windows e macOS", () => {
    expect(buildClientFolderName('Obra 12/25: "Casa" <SP>')).toBe(
      "Obra 12-25- -Casa- -SP-",
    );
  });

  it("nao deixa pasta sem nome", () => {
    expect(buildClientFolderName("   ")).toBe("Cliente sem nome");
  });

  it("prefixa o numero da proposta quando existe", () => {
    expect(buildProposalFileName(12, "Automação da sala")).toBe(
      "12 - Automação da sala.pdf",
    );
    expect(buildProposalFileName(undefined, "Automação da sala")).toBe(
      "Automação da sala.pdf",
    );
  });
});
