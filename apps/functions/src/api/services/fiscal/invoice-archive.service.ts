/**
 * Espelha DANFE e XML autorizados no nosso Storage.
 *
 * Não é conveniência: **documento fiscal tem guarda legal de 5 anos + o ano
 * corrente** (cláusula décima do Ajuste SINIEF 07/2005, art. 173 do CTN), e a
 * multa por nota ausente numa fiscalização passa de R$ 1.000.
 *
 * Depender dos links do provedor deixaria esse acervo fora do nosso controle:
 * sair do Focus, ter uma conta suspensa ou simplesmente uma mudança de política
 * de retenção apagaria anos de obrigação legal do cliente. O XML é o documento
 * que vale — o PDF é representação.
 *
 * O espelhamento é **best-effort e idempotente**: falhar aqui não pode desfazer
 * uma nota que a SEFAZ já autorizou. Um arquivo que não desceu é tentado de
 * novo no próximo evento ou no ciclo do cron.
 */

import axios from "axios";
import { getStorage } from "firebase-admin/storage";
import { db } from "../../../init";
import { logger } from "../../../lib/logger";
import type { InvoiceDocument } from "./invoice.service";

const DOWNLOAD_TIMEOUT_MS = 30_000;
/** DANFE e XML de nota são arquivos pequenos; acima disso algo está errado. */
const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Documento da nota, ou de uma carta de correcao especifica (1-based). */
export type ArchiveKind = "pdf" | "xml";

const NOME_DA_NOTA: Record<ArchiveKind, string> = {
  pdf: "danfe.pdf",
  xml: "nota.xml",
};

export function buildArchivePath(
  tenantId: string,
  invoiceId: string,
  kind: ArchiveKind,
  /**
   * Indice da carta de correcao (1-based). Cada CC-e e um EVENTO distinto, com
   * protocolo proprio e guarda legal propria — a ultima prevalecer perante o
   * fisco nao apaga a existencia das anteriores.
   */
  correcaoIndice?: number,
): string {
  const base = `tenants/${tenantId}/fiscal/${invoiceId}`;
  if (correcaoIndice !== undefined) {
    return `${base}/cce-${correcaoIndice}.${kind === "pdf" ? "pdf" : "xml"}`;
  }
  return `${base}/${NOME_DA_NOTA[kind]}`;
}

/**
 * `token` e a credencial do documento no provedor.
 *
 * O caminho do DANFE e do XML da NF-e e RELATIVO a API do provedor e exige
 * autenticacao — sem o token o download volta 401 e o arquivo nunca desce. Ja o
 * DANFSe vem de um S3 publico, e por isso a NFS-e sempre funcionou. Opcional
 * para nao alterar o caminho que ja da certo.
 */
async function download(url: string, token?: string): Promise<Buffer | null> {
  try {
    const response = await axios.get<ArrayBuffer>(url, {
      responseType: "arraybuffer",
      timeout: DOWNLOAD_TIMEOUT_MS,
      maxContentLength: MAX_FILE_BYTES,
      // Basic com o token no usuario e senha em branco — o mesmo esquema que o
      // provedor usa nas demais chamadas.
      ...(token ? { auth: { username: token, password: "" } } : {}),
    });
    return Buffer.from(response.data);
  } catch (error) {
    logger.warn("Download de documento fiscal falhou", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function mirror(
  invoice: InvoiceDocument,
  url: string,
  kind: ArchiveKind,
  options: { token?: string; correcaoIndice?: number } = {},
): Promise<string | null> {
  const path = buildArchivePath(
    invoice.tenantId,
    invoice.id,
    kind,
    options.correcaoIndice,
  );
  const file = getStorage().bucket().file(path);

  // Idempotente: um reenvio do mesmo evento não rebaixa nem duplica o arquivo.
  const [exists] = await file.exists();
  if (exists) {
    return path;
  }

  const buffer = await download(url, options.token);
  if (!buffer) {
    return null;
  }

  await file.save(buffer, {
    contentType: kind === "pdf" ? "application/pdf" : "application/xml",
    resumable: false,
    metadata: {
      // Documento fiscal é imutável: uma vez autorizado, o conteúdo nunca muda.
      cacheControl: "private, max-age=31536000, immutable",
      metadata: {
        tenantId: invoice.tenantId,
        invoiceId: invoice.id,
        chaveAcesso: invoice.chaveAcesso ?? "",
        numero: invoice.numero ?? "",
      },
    },
  });

  return path;
}

/**
 * Baixa e arquiva os documentos de uma nota autorizada.
 *
 * Só faz sentido depois de `authorized` — antes disso o provedor não expõe os
 * links. Nunca lança: a nota já é válida perante o fisco, e uma falha de
 * arquivamento não pode transformar isso em erro para o usuário.
 */
export async function archiveInvoiceDocuments(invoice: InvoiceDocument): Promise<void> {
  if (invoice.status !== "authorized") {
    return;
  }
  if (invoice.storagePdfPath && invoice.storageXmlPath) {
    return;
  }

  try {
    const update: Record<string, string> = {};

    if (invoice.pdfUrl && !invoice.storagePdfPath) {
      const path = await mirror(invoice, invoice.pdfUrl, "pdf");
      if (path) update.storagePdfPath = path;
    }

    if (invoice.xmlUrl && !invoice.storageXmlPath) {
      const path = await mirror(invoice, invoice.xmlUrl, "xml");
      if (path) update.storageXmlPath = path;
    }

    if (Object.keys(update).length > 0) {
      await db
        .collection("invoices")
        .doc(invoice.id)
        .update({ ...update, updatedAt: new Date().toISOString() });

      logger.info("Documentos fiscais arquivados", {
        tenantId: invoice.tenantId,
        invoiceId: invoice.id,
        arquivos: Object.keys(update),
      });
    }
  } catch (error) {
    // O cron de consulta reencontra a nota e tenta de novo.
    logger.error("Arquivamento de documentos fiscais falhou", {
      tenantId: invoice.tenantId,
      invoiceId: invoice.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Lê um documento arquivado para download autenticado pelo backend.
 *
 * O download passa por aqui e não por link direto porque `storage.rules` nega
 * a pasta `fiscal/` ao client — e porque `application/xml` sequer está na
 * allowlist de content-type do bucket.
 */
export async function readArchivedDocument(
  tenantId: string,
  invoiceId: string,
  kind: ArchiveKind,
  correcaoIndice?: number,
): Promise<Buffer | null> {
  const file = getStorage()
    .bucket()
    .file(buildArchivePath(tenantId, invoiceId, kind, correcaoIndice));
  const [exists] = await file.exists();
  if (!exists) {
    return null;
  }
  const [buffer] = await file.download();
  return buffer;
}

/**
 * Espelha os documentos de UMA carta de correcao.
 *
 * Chamado logo apos o fisco registrar o evento, com o token da empresa em mao —
 * o caminho devolvido pelo provedor e relativo a API dele e exige autenticacao.
 *
 * Best-effort pelo mesmo motivo do arquivamento da nota: a correcao ja esta
 * registrada na SEFAZ, e falhar em guardar uma copia nao pode virar erro para
 * quem acabou de corrigir. O que se perde e a copia, nunca o evento.
 */
export async function archiveCorrectionDocuments(
  invoice: InvoiceDocument,
  correcaoIndice: number,
  urls: { xmlUrl?: string; pdfUrl?: string },
  token: string,
): Promise<{ storageXmlPath?: string; storagePdfPath?: string }> {
  const saida: { storageXmlPath?: string; storagePdfPath?: string } = {};
  try {
    if (urls.xmlUrl) {
      const path = await mirror(invoice, urls.xmlUrl, "xml", {
        token,
        correcaoIndice,
      });
      if (path) saida.storageXmlPath = path;
    }
    if (urls.pdfUrl) {
      const path = await mirror(invoice, urls.pdfUrl, "pdf", {
        token,
        correcaoIndice,
      });
      if (path) saida.storagePdfPath = path;
    }
  } catch (error) {
    logger.error("Arquivamento da carta de correcao falhou", {
      tenantId: invoice.tenantId,
      invoiceId: invoice.id,
      correcaoIndice,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return saida;
}
