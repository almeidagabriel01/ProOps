/**
 * Invoice lifecycle: create, issue, and settle.
 *
 * Issuing is asynchronous — the provider validates the payload synchronously
 * and then queues the document for the SEFAZ or the municipality, which can
 * take from seconds to minutes. So the endpoint answers 202 with a document in
 * `processing`, and the outcome arrives by one of two paths:
 *
 *  1. the provider's webhook (fast path), or
 *  2. `processInvoiceRetries` polling (fallback).
 *
 * The fallback is not belt-and-braces. Focus retries a failed webhook five
 * times over 24 hours and then **stops forever**; without polling, a delivery
 * outage during that window would strand the invoice permanently.
 */

import { FieldValue } from "firebase-admin/firestore";
import { db } from "../../../init";
import { logger } from "../../../lib/logger";
import { getIssuingToken, setFiscalStatus } from "./fiscal-settings.service";
import { archiveInvoiceDocuments } from "./invoice-archive.service";
import { describeFocusError } from "./focus-error";
import {
  getFiscalProvider,
  resolveFiscalEnvironment,
} from "./fiscal-provider.registry";
import type { FiscalProviderId } from "./fiscal-provider";
import {
  isTerminalInvoiceStatus,
  type FiscalDocumentType,
  type FiscalInvoiceInput,
  type FiscalInvoiceResult,
  type FiscalInvoiceStatus,
  type FiscalNfsePadrao,
} from "./fiscal-types";

const COLLECTION = "invoices";

/** Retry pacing for the polling fallback. */
const MAX_RETRY_COUNT = 8;
const RETRY_DELAY_MS = 15 * 60 * 1000;

export interface InvoiceDocument {
  id: string;
  tenantId: string;
  provider: FiscalProviderId;
  /** Our reference, also the provider's idempotency key. */
  ref: string;
  type: FiscalDocumentType;
  status: FiscalInvoiceStatus;
  environment: string;
  /**
   * Padrão da NFS-e com que ESTA nota foi emitida.
   *
   * Fica na nota, e não só nas configurações do tenant, porque consultar e
   * cancelar têm que usar o mesmo recurso com que ela nasceu. Se o tenant
   * migrar de municipal para nacional, as notas antigas continuam sendo
   * canceláveis; ler o padrão atual as tornaria inalcançáveis.
   */
  padraoNfse?: FiscalNfsePadrao;

  numero?: string;
  serie?: string;
  chaveAcesso?: string;
  protocolo?: string;
  codigoVerificacao?: string;

  /** Provider-hosted links, mirrored to our Storage once authorized. */
  pdfUrl?: string;
  xmlUrl?: string;
  publicUrl?: string;
  storagePdfPath?: string;
  storageXmlPath?: string;

  valorTotal: number;
  clientId?: string;
  clientName?: string;
  transactionId?: string;
  proposalId?: string;

  rejectionCode?: string;
  rejectionMessage?: string;

  retryCount: number;
  nextRetryAt?: string;

  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  authorizedAt?: string;
  cancelledAt?: string;
}

function docRef(invoiceId: string) {
  return db.collection(COLLECTION).doc(invoiceId);
}

/**
 * Builds the reference sent to the provider.
 *
 * Deterministic on the invoice id so a retry of the same document reuses it —
 * Focus answers `already_processed` instead of issuing a second note, which is
 * what makes the whole flow idempotent without extra bookkeeping.
 */
export function buildInvoiceRef(invoiceId: string): string {
  return `proops-${invoiceId}`;
}

export interface CreateInvoiceInput {
  tenantId: string;
  type: FiscalDocumentType;
  environment: string;
  valorTotal: number;
  clientId?: string;
  clientName?: string;
  transactionId?: string;
  proposalId?: string;
  createdBy?: string;
  provider?: FiscalProviderId;
}

/** Creates the document in `draft`. Nothing has been sent yet. */
export async function createInvoice(input: CreateInvoiceInput): Promise<InvoiceDocument> {
  const ref = db.collection(COLLECTION).doc();
  const now = new Date().toISOString();

  const invoice: InvoiceDocument = {
    id: ref.id,
    tenantId: input.tenantId,
    provider: input.provider ?? "focus",
    ref: buildInvoiceRef(ref.id),
    type: input.type,
    status: "draft",
    environment: input.environment,
    valorTotal: input.valorTotal,
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
    ...(input.clientId ? { clientId: input.clientId } : {}),
    ...(input.clientName ? { clientName: input.clientName } : {}),
    ...(input.transactionId ? { transactionId: input.transactionId } : {}),
    ...(input.proposalId ? { proposalId: input.proposalId } : {}),
    ...(input.createdBy ? { createdBy: input.createdBy } : {}),
  };

  await ref.set(invoice);
  return invoice;
}

export async function getInvoice(invoiceId: string): Promise<InvoiceDocument | null> {
  const snap = await docRef(invoiceId).get();
  return snap.exists ? (snap.data() as InvoiceDocument) : null;
}

/** Finds an invoice by the reference the provider echoes back. */
export async function findInvoiceByRef(
  tenantId: string,
  ref: string,
): Promise<InvoiceDocument | null> {
  const snap = await db
    .collection(COLLECTION)
    .where("tenantId", "==", tenantId)
    .where("ref", "==", ref)
    .limit(1)
    .get();

  return snap.empty ? null : (snap.docs[0].data() as InvoiceDocument);
}

/**
 * Whether an incoming provider status may overwrite the stored one.
 *
 * Webhooks are not ordered, and the polling fallback can race a webhook for
 * the same document. Without this guard a delayed `processando_autorizacao`
 * arriving after `autorizado` would walk an authorized invoice backwards and
 * put it back in the retry queue.
 *
 * The one transition allowed out of a terminal state is authorized → cancelled,
 * which is a real event.
 */
export function canApplyStatus(
  current: FiscalInvoiceStatus,
  incoming: FiscalInvoiceStatus,
): boolean {
  if (current === incoming) return false;
  if (!isTerminalInvoiceStatus(current)) return true;
  return current === "authorized" && incoming === "cancelled";
}

/**
 * Applies a provider result to the stored invoice.
 *
 * Returns whether anything changed, so callers can skip side effects
 * (notifications, document mirroring) on a duplicate delivery.
 */
export async function applyInvoiceResult(
  invoiceId: string,
  result: FiscalInvoiceResult,
): Promise<{ applied: boolean; status: FiscalInvoiceStatus }> {
  return db.runTransaction(async (t) => {
    const snap = await t.get(docRef(invoiceId));
    if (!snap.exists) {
      throw new Error("INVOICE_NOT_FOUND");
    }

    const current = snap.data() as InvoiceDocument;
    if (!canApplyStatus(current.status, result.status)) {
      logger.info("Evento fiscal ignorado — status nao regride", {
        invoiceId,
        atual: current.status,
        recebido: result.status,
      });
      return { applied: false, status: current.status };
    }

    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
      status: result.status,
      updatedAt: now,
    };

    const copy: Array<[string, unknown]> = [
      ["numero", result.numero],
      ["serie", result.serie],
      ["chaveAcesso", result.chaveAcesso],
      ["protocolo", result.protocolo],
      ["codigoVerificacao", result.codigoVerificacao],
      ["pdfUrl", result.pdfUrl],
      ["xmlUrl", result.xmlUrl],
      ["publicUrl", result.publicUrl],
    ];
    for (const [field, value] of copy) {
      if (value !== undefined) update[field] = value;
    }

    if (result.status === "authorized") {
      update.authorizedAt = now;
      // A previous failure is no longer relevant once the document is valid.
      update.rejectionCode = FieldValue.delete();
      update.rejectionMessage = FieldValue.delete();
      update.nextRetryAt = FieldValue.delete();
    } else if (result.status === "cancelled") {
      update.cancelledAt = now;
      update.nextRetryAt = FieldValue.delete();
    } else if (result.status === "rejected") {
      // Permanent: the SEFAZ or the municipality refused the content. Retrying
      // reproduces the same refusal and consumes provider quota.
      update.nextRetryAt = FieldValue.delete();
      if (result.rejectionCode) update.rejectionCode = result.rejectionCode;
      if (result.rejectionMessage) update.rejectionMessage = result.rejectionMessage;
    }

    t.update(docRef(invoiceId), update);
    return { applied: true, status: result.status };
  }).then(async (outcome) => {
    // Guarda legal de 5 anos + ano corrente: o acervo tem que ser nosso, nao
    // um link do provedor. Best-effort — a nota ja vale perante o fisco, e
    // falhar o arquivamento nao pode virar erro para o usuario.
    if (outcome.applied && outcome.status === "authorized") {
      const refreshed = await getInvoice(invoiceId);
      if (refreshed) {
        await archiveInvoiceDocuments(refreshed);
        // Uma nota AUTORIZADA é a única prova de que o emitente está de fato
        // credenciado na SEFAZ ou na prefeitura. Homologação valida o nosso
        // código; só a autorização valida o cadastro dele no fisco. É esse
        // fato — e não o upload do certificado — que libera a emissão real.
        await markIssuerReady(refreshed.tenantId);
      }
    }
    return outcome;
  });
}

/**
 * Promove o emitente a `ready` na primeira nota autorizada.
 *
 * Best-effort e idempotente: a nota já vale perante o fisco, e falhar aqui não
 * pode virar erro para o usuário nem desfazer nada. O pior caso é o botão de
 * ativar emissão real demorar um ciclo a mais para aparecer.
 */
async function markIssuerReady(tenantId: string): Promise<void> {
  try {
    await setFiscalStatus(tenantId, "ready");
  } catch (error) {
    logger.warn("Nao foi possivel promover o emitente para ready", {
      tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Marks the document as awaiting a provider answer and schedules the fallback poll. */
async function markProcessing(invoiceId: string): Promise<void> {
  await docRef(invoiceId).update({
    status: "processing",
    updatedAt: new Date().toISOString(),
    nextRetryAt: new Date(Date.now() + RETRY_DELAY_MS).toISOString(),
  });
}

/**
 * Records a transport failure and decides whether it is worth another attempt.
 * A permanent failure ends the invoice in `rejected` — it will never succeed.
 */
async function markFailure(
  invoiceId: string,
  detail: { message: string; codigo?: string; retryable: boolean },
  retryCount: number,
): Promise<void> {
  const exhausted = retryCount >= MAX_RETRY_COUNT;
  const terminal = !detail.retryable || exhausted;

  await docRef(invoiceId).update({
    status: terminal ? "rejected" : "error",
    rejectionMessage: detail.message,
    ...(detail.codigo ? { rejectionCode: detail.codigo } : {}),
    retryCount: FieldValue.increment(1),
    updatedAt: new Date().toISOString(),
    ...(terminal
      ? { nextRetryAt: FieldValue.delete() }
      : { nextRetryAt: new Date(Date.now() + RETRY_DELAY_MS).toISOString() }),
  });

  logger.error("Emissao fiscal falhou", {
    invoiceId,
    codigo: detail.codigo,
    retryable: detail.retryable,
    exhausted,
    error: detail.message,
  });
}

/**
 * Sends the document to the provider.
 *
 * Never throws for a provider-side failure — the outcome is recorded on the
 * invoice and returned, because an exception here would lose the record of
 * *why* it failed, which is exactly what the user needs to fix it.
 */
export async function issueInvoice(
  invoiceId: string,
  input: FiscalInvoiceInput,
): Promise<InvoiceDocument> {
  const stored = await getInvoice(invoiceId);
  if (!stored) {
    throw new Error("INVOICE_NOT_FOUND");
  }
  if (isTerminalInvoiceStatus(stored.status)) {
    // Re-issuing an authorized document would duplicate it fiscally.
    throw new Error("INVOICE_JA_FINALIZADA");
  }

  const provider = getFiscalProvider(stored.provider);
  const env = resolveFiscalEnvironment(stored.environment);

  try {
    const token = await getIssuingToken(stored.tenantId, env);
    const padraoNfse = input.issuer.padraoNfse;
    if (stored.type === "nfse" && padraoNfse && stored.padraoNfse !== padraoNfse) {
      await db.collection(COLLECTION).doc(invoiceId).update({ padraoNfse });
    }
    const result = await provider.issue({ ...input, ref: stored.ref }, env, token);

    if (result.status === "processing") {
      await markProcessing(invoiceId);
    } else {
      await applyInvoiceResult(invoiceId, result);
    }
  } catch (error) {
    const detail = describeFocusError(error);
    await markFailure(invoiceId, detail, stored.retryCount);
  }

  const refreshed = await getInvoice(invoiceId);
  return refreshed ?? stored;
}

/**
 * Polls the provider for documents whose outcome never arrived.
 * Returns the number of invoices whose status actually moved.
 */
/**
 * Consulta UMA nota no provedor, agora, e aplica o resultado.
 *
 * O cron `processInvoiceRetries` faz isso sozinho, mas só 15 minutos depois da
 * emissão. Esse intervalo é certo para a máquina e péssimo para quem está
 * olhando a tela: sem uma consulta sob demanda, a única saída era abrir o
 * painel do provedor, e aí o ERP deixou de ser a fonte da verdade.
 *
 * Não força nada: só lê o estado no provedor e deixa `canApplyStatus` decidir
 * se ele avança o documento — status continua não regredindo.
 */
export async function refreshInvoice(invoiceId: string): Promise<InvoiceDocument | null> {
  const stored = await getInvoice(invoiceId);
  if (!stored) {
    throw new Error("INVOICE_NOT_FOUND");
  }
  if (isTerminalInvoiceStatus(stored.status)) {
    return stored;
  }

  const provider = getFiscalProvider(stored.provider);
  const env = resolveFiscalEnvironment(stored.environment);
  const result = await provider.consult(
    stored.ref,
    stored.type,
    env,
    await getIssuingToken(stored.tenantId, env),
    stored.padraoNfse,
  );

  await applyInvoiceResult(invoiceId, result);
  return getInvoice(invoiceId);
}

export async function pollPendingInvoices(limit = 100): Promise<number> {
  const snap = await db
    .collection(COLLECTION)
    .where("status", "in", ["processing", "error"])
    .where("nextRetryAt", "<=", new Date().toISOString())
    .limit(limit)
    .get();

  let settled = 0;

  for (const doc of snap.docs) {
    const invoice = doc.data() as InvoiceDocument;
    try {
      const provider = getFiscalProvider(invoice.provider);
      const env = resolveFiscalEnvironment(invoice.environment);
      const result = await provider.consult(
        invoice.ref,
        invoice.type,
        env,
        await getIssuingToken(invoice.tenantId, env),
        invoice.padraoNfse,
      );

      const { applied } = await applyInvoiceResult(invoice.id, result);
      if (applied) {
        settled += 1;
      } else if (result.status === "processing") {
        // Still queued at the authority — push the next poll out instead of
        // hammering the provider every cron tick.
        await docRef(invoice.id).update({
          retryCount: FieldValue.increment(1),
          nextRetryAt: new Date(Date.now() + RETRY_DELAY_MS).toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      const detail = describeFocusError(error);
      await markFailure(invoice.id, detail, invoice.retryCount).catch(() => undefined);
    }
  }

  return settled;
}

/** Lists a tenant's invoices, newest first. */
export async function listInvoices(
  tenantId: string,
  options: { limit?: number; status?: string } = {},
): Promise<InvoiceDocument[]> {
  let query = db
    .collection(COLLECTION)
    .where("tenantId", "==", tenantId) as FirebaseFirestore.Query;

  if (options.status) {
    query = query.where("status", "==", options.status);
  }

  const snap = await query.orderBy("createdAt", "desc").limit(options.limit ?? 50).get();
  return snap.docs.map((doc) => doc.data() as InvoiceDocument);
}

/** Cancels an authorized document. Justification length is validated by the caller. */
export async function cancelInvoice(
  invoiceId: string,
  justificativa: string,
): Promise<InvoiceDocument> {
  const stored = await getInvoice(invoiceId);
  if (!stored) {
    throw new Error("INVOICE_NOT_FOUND");
  }
  if (stored.status !== "authorized") {
    throw new Error("INVOICE_NAO_AUTORIZADA");
  }

  const provider = getFiscalProvider(stored.provider);
  const env = resolveFiscalEnvironment(stored.environment);
  const result = await provider.cancel(
    stored.ref,
    stored.type,
    justificativa,
    env,
    await getIssuingToken(stored.tenantId, env),
    stored.padraoNfse,
  );

  await applyInvoiceResult(invoiceId, result);
  return (await getInvoice(invoiceId)) ?? stored;
}

/**
 * Carta de Correção Eletrônica — NF-e apenas.
 *
 * Não pode alterar valores, CNPJ do destinatário, NCM, CFOP nem dados de
 * fatura; para esses o caminho é cancelar e reemitir. NFS-e não tem CC-e: o
 * mecanismo municipal é cancelamento e substituição.
 *
 * @throws quando a nota não é NF-e autorizada — corrigir um documento que a
 * SEFAZ não autorizou não faz sentido e a chamada seria recusada.
 */
export async function correctInvoice(
  invoiceId: string,
  texto: string,
): Promise<InvoiceDocument> {
  const stored = await getInvoice(invoiceId);
  if (!stored) {
    throw new Error("INVOICE_NOT_FOUND");
  }
  if (stored.type !== "nfe") {
    throw new Error("CCE_APENAS_NFE");
  }
  if (stored.status !== "authorized") {
    throw new Error("INVOICE_NAO_AUTORIZADA");
  }

  const provider = getFiscalProvider(stored.provider);
  if (!provider.correct) {
    throw new Error("CCE_NAO_SUPORTADA");
  }

  const env = resolveFiscalEnvironment(stored.environment);
  await provider.correct(
    stored.ref,
    texto,
    env,
    await getIssuingToken(stored.tenantId, env),
  );

  return (await getInvoice(invoiceId)) ?? stored;
}

/**
 * Pede ao provedor que reenvie a notificação desta nota.
 *
 * Recupera um evento perdido sem reemitir nada — o Focus desiste depois de
 * cinco tentativas em 24h, e esta é a saída manual quando isso acontece e o
 * usuário não quer esperar o próximo ciclo do cron.
 */
export async function replayInvoiceNotification(invoiceId: string): Promise<void> {
  const stored = await getInvoice(invoiceId);
  if (!stored) {
    throw new Error("INVOICE_NOT_FOUND");
  }

  const provider = getFiscalProvider(stored.provider);
  if (!provider.replayNotification) {
    throw new Error("REENVIO_NAO_SUPORTADO");
  }

  const env = resolveFiscalEnvironment(stored.environment);
  await provider.replayNotification(
    stored.ref,
    stored.type,
    env,
    await getIssuingToken(stored.tenantId, env),
    stored.padraoNfse,
  );
}

export { MAX_RETRY_COUNT, RETRY_DELAY_MS };
