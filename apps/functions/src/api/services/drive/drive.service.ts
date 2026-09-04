/**
 * Entrega a proposta na pasta do cliente, no Drive do proprio tenant.
 *
 * A dor que isto resolve e "nao manter duas organizacoes": o cliente ja guarda
 * projeto, memorial e planta numa pasta por cliente no Drive dele, e so
 * faltava a proposta gerada pelo ERP chegar la sem alguem baixar e subir a
 * mao. Por isso a integracao e **so de ida** — nada e lido do Drive.
 *
 * Duas consequencias do escopo `drive.file` (ver `drive-oauth.service.ts`) que
 * moldam este arquivo:
 *
 * 1. **Nao enxergamos pasta que nao criamos.** A raiz vem do Picker; as
 *    subpastas por cliente sao criadas por nos e o id fica gravado no proprio
 *    contato. Sem gravar, a proxima proposta criaria uma pasta duplicada — nao
 *    ha como procurar pelo nome o que nao podemos listar.
 * 2. **Um arquivo por proposta, ATUALIZADO.** Reenviar a mesma proposta troca
 *    o conteudo do arquivo que ja existe em vez de criar outro. O Drive guarda
 *    o historico de versoes sozinho, e a pasta do cliente continua legivel —
 *    subir um arquivo novo a cada geracao encheria a pasta de rascunho e
 *    destruiria justamente a organizacao que a integracao promete.
 */

import { Readable } from "stream";
import { db } from "../../../init";
import { logger } from "../../../lib/logger";
import { getDriveClient } from "./drive-oauth.service";

const CLIENTS_COLLECTION = "clients";
const PROPOSALS_COLLECTION = "proposals";
const FOLDER_MIME = "application/vnd.google-apps.folder";

/**
 * Caracteres que o Drive aceita mas que atrapalham quem sincroniza a pasta com
 * o Windows ou o macOS — o arquivo desce com nome quebrado ou nao desce.
 */
function sanitizeName(value: string): string {
  return String(value || "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export function buildClientFolderName(clientName: string): string {
  return sanitizeName(clientName) || "Cliente sem nome";
}

export function buildProposalFileName(
  proposalNumber: string | number | undefined,
  title: string | undefined,
): string {
  const numero = String(proposalNumber ?? "").trim();
  const nome = sanitizeName(title || "Proposta");
  return numero ? `${numero} - ${nome}.pdf` : `${nome}.pdf`;
}

/**
 * Id da pasta do cliente, criando-a na raiz se ainda nao existir.
 *
 * O id gravado no contato e a unica forma de reencontrar a pasta: com
 * `drive.file` nao da para procurar por nome. Isso tambem e o que permite ao
 * usuario APONTAR uma pasta que ja existia (via Picker) — basta o id no
 * contato apontar para ela.
 *
 * @throws `DRIVE_SEM_PASTA_RAIZ` quando o tenant conectou a conta mas ainda
 * nao escolheu onde as pastas devem morar.
 */
export async function ensureClientFolder(
  tenantId: string,
  clientId: string,
): Promise<string> {
  const clientRef = db.collection(CLIENTS_COLLECTION).doc(clientId);
  const clientSnap = await clientRef.get();
  if (!clientSnap.exists) {
    throw new Error("CLIENTE_NAO_ENCONTRADO");
  }

  const clientData = clientSnap.data() as {
    tenantId?: string;
    name?: string;
    driveFolderId?: string;
  };
  if (clientData.tenantId !== tenantId) {
    throw new Error("CLIENTE_DE_OUTRO_TENANT");
  }
  if (clientData.driveFolderId) {
    return clientData.driveFolderId;
  }

  const { client, integration } = await getDriveClient(tenantId);
  if (!integration.rootFolderId) {
    throw new Error("DRIVE_SEM_PASTA_RAIZ");
  }

  const created = await client.files.create({
    requestBody: {
      name: buildClientFolderName(clientData.name || ""),
      mimeType: FOLDER_MIME,
      parents: [integration.rootFolderId],
    },
    fields: "id",
    // Sem isto, criar dentro de um Drive compartilhado falha — e Drive
    // compartilhado e justamente a recomendacao para quem tem equipe.
    supportsAllDrives: true,
  });

  const folderId = String(created.data.id || "").trim();
  if (!folderId) {
    throw new Error("DRIVE_FALHA_AO_CRIAR_PASTA");
  }

  await clientRef.update({
    driveFolderId: folderId,
    updatedAt: new Date().toISOString(),
  });

  logger.info("Pasta do cliente criada no Drive", {
    tenantId,
    clientId,
    folderId,
  });
  return folderId;
}

/**
 * Nome da pasta que a ProOps cria quando o usuario nao quer escolher uma.
 *
 * Hifen simples e nao travessao: a pasta e sincronizada para Windows e macOS
 * por quem usa o Drive de desktop, e caractere fora do ASCII no nome de pasta e
 * fonte classica de arquivo que nao desce.
 */
export const DEFAULT_ROOT_FOLDER_NAME = "ProOps - Propostas";

/**
 * Cria a pasta raiz no Drive do tenant, na raiz do "Meu Drive".
 *
 * Alternativa ao Google Picker, e nao um substituto pior: no escopo
 * `drive.file` o acesso segue o ARQUIVO, nao o caminho — o usuario pode
 * **mover, renomear e compartilhar** esta pasta livremente que continuamos
 * enxergando ela. Na pratica ele arrasta a pasta para dentro da estrutura que
 * ja tem e o resultado e o mesmo de ter apontado uma pasta existente.
 *
 * Isso importa porque o Picker cobra caro em configuracao (API key propria,
 * Picker API, popup, cookies de terceiros) e falha de formas que dependem do
 * navegador do CLIENTE — o que nao pode ser pre-requisito para usar o modulo.
 *
 * Idempotente: se ja houver uma raiz definida, devolve ela em vez de criar
 * outra. Dois cliques no botao nao podem produzir duas pastas.
 */
export async function createRootFolder(
  tenantId: string,
): Promise<{ folderId: string; folderName: string }> {
  const { client, integration } = await getDriveClient(tenantId);
  if (integration.rootFolderId) {
    return {
      folderId: integration.rootFolderId,
      folderName: integration.rootFolderName || DEFAULT_ROOT_FOLDER_NAME,
    };
  }

  const created = await client.files.create({
    // Sem `parents`: nasce na raiz do "Meu Drive", de onde o usuario move para
    // onde quiser.
    requestBody: {
      name: DEFAULT_ROOT_FOLDER_NAME,
      mimeType: FOLDER_MIME,
    },
    fields: "id",
    supportsAllDrives: true,
  });

  const folderId = String(created.data.id || "").trim();
  if (!folderId) {
    throw new Error("DRIVE_FALHA_AO_CRIAR_PASTA");
  }

  logger.info("Pasta raiz criada no Drive", { tenantId, folderId });
  return { folderId, folderName: DEFAULT_ROOT_FOLDER_NAME };
}

export interface UploadProposalResult {
  fileId: string;
  folderId: string;
  webViewLink: string | null;
}

/**
 * Sobe (ou atualiza) o PDF da proposta na pasta do cliente.
 *
 * O id do arquivo fica gravado na proposta para que o proximo envio ATUALIZE
 * em vez de duplicar. Se o arquivo tiver sido apagado no Drive, a atualizacao
 * falha com 404 e caimos para criar de novo — apagar um arquivo la nao pode
 * deixar a proposta permanentemente sem entrega.
 */
export async function uploadProposalPdf(params: {
  tenantId: string;
  proposalId: string;
  clientId: string;
  fileName: string;
  pdf: Buffer;
}): Promise<UploadProposalResult> {
  const folderId = await ensureClientFolder(params.tenantId, params.clientId);
  const { client } = await getDriveClient(params.tenantId);

  const proposalRef = db
    .collection(PROPOSALS_COLLECTION)
    .doc(params.proposalId);
  const proposalSnap = await proposalRef.get();
  const existingFileId = String(
    (proposalSnap.data() as { driveFileId?: string } | undefined)
      ?.driveFileId || "",
  ).trim();

  const media = {
    mimeType: "application/pdf",
    // Stream e nao Buffer: a lib do Google espera um corpo legivel, e passar o
    // Buffer direto sobe o arquivo com 0 byte em algumas versoes.
    body: Readable.from(params.pdf),
  };

  let fileId = existingFileId;
  let webViewLink: string | null = null;

  if (existingFileId) {
    try {
      const updated = await client.files.update({
        fileId: existingFileId,
        media,
        requestBody: { name: params.fileName },
        fields: "id, webViewLink",
        supportsAllDrives: true,
      });
      fileId = String(updated.data.id || existingFileId);
      webViewLink = updated.data.webViewLink ?? null;
    } catch (error) {
      // Arquivo apagado no Drive: recriar e o comportamento util.
      logger.warn("Arquivo da proposta nao encontrado no Drive; recriando", {
        tenantId: params.tenantId,
        proposalId: params.proposalId,
        error: error instanceof Error ? error.message : String(error),
      });
      fileId = "";
    }
  }

  if (!fileId) {
    const created = await client.files.create({
      requestBody: { name: params.fileName, parents: [folderId] },
      media,
      fields: "id, webViewLink",
      supportsAllDrives: true,
    });
    fileId = String(created.data.id || "").trim();
    webViewLink = created.data.webViewLink ?? null;
  }

  if (!fileId) {
    throw new Error("DRIVE_FALHA_AO_ENVIAR_ARQUIVO");
  }

  await proposalRef.update({
    driveFileId: fileId,
    driveSyncedAt: new Date().toISOString(),
  });

  return { fileId, folderId, webViewLink };
}
