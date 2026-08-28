/**
 * Sincronização e manifestação de notas de entrada.
 *
 * A nota é do fornecedor: não controlamos numeração, não assinamos e não
 * cancelamos. Nosso papel é receber, arquivar e permitir a manifestação.
 *
 * A sincronização é **incremental por versão**. Cada nota recebida tem um campo
 * `versao`, único por CNPJ e incrementado a cada alteração — cancelamento ou
 * carta de correção. Guardando a maior versão vista por tenant, cada consulta
 * traz só o que mudou, e um cancelamento posterior chega sozinho em vez de
 * exigir reconsulta nota por nota.
 */

import { db } from "../../../init";
import { logger } from "../../../lib/logger";
import { describeFocusError } from "./focus-error";
import { focusFiscalProvider } from "./focus.provider";
import { resolveFiscalEnvironment } from "./fiscal-provider.registry";
import { getFiscalSettings, getIssuingToken } from "./fiscal-settings.service";
import {
  mapReceivedInvoice,
  maxVersionOf,
  type FocusReceivedSummary,
} from "./received-invoice-mapper";
import {
  shouldApplyReceivedVersion,
  type ManifestationType,
  type ReceivedInvoiceDocument,
} from "./received-invoice.types";

const COLLECTION = "received_invoices";

/** Documento por tenant que guarda o cursor de sincronização. */
const CURSOR_COLLECTION = "received_invoice_cursors";

/**
 * A chave de acesso é a identidade da nota, mas o id do documento inclui o
 * tenant: dois tenants podem, legitimamente, receber a mesma nota — um
 * fornecedor que venda para as duas empresas de um mesmo grupo.
 */
function buildDocId(tenantId: string, chaveAcesso: string): string {
  return `${tenantId}_${chaveAcesso}`;
}

async function readCursor(tenantId: string): Promise<number> {
  const snap = await db.collection(CURSOR_COLLECTION).doc(tenantId).get();
  const value = Number((snap.data() as { versao?: number } | undefined)?.versao);
  return Number.isFinite(value) ? value : 0;
}

async function writeCursor(tenantId: string, versao: number): Promise<void> {
  await db
    .collection(CURSOR_COLLECTION)
    .doc(tenantId)
    .set({ versao, updatedAt: new Date().toISOString() }, { merge: true });
}

/**
 * Grava ou atualiza uma nota recebida.
 * Retorna `false` quando o documento armazenado já está numa versão igual ou
 * mais recente — o que acontece a cada reprocessamento e é o caso normal.
 */
export async function upsertReceivedInvoice(
  tenantId: string,
  raw: FocusReceivedSummary,
): Promise<boolean> {
  const mapped = mapReceivedInvoice(raw, tenantId);
  const docId = buildDocId(tenantId, mapped.chaveAcesso);
  const ref = db.collection(COLLECTION).doc(docId);

  return db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    const stored = snap.exists ? (snap.data() as ReceivedInvoiceDocument) : undefined;

    if (!shouldApplyReceivedVersion(stored?.versao, mapped.versao)) {
      return false;
    }

    const now = new Date().toISOString();
    t.set(
      ref,
      {
        ...mapped,
        id: docId,
        updatedAt: now,
        ...(stored ? {} : { createdAt: now }),
      },
      { merge: true },
    );
    return true;
  });
}

export interface SyncResult {
  fetched: number;
  applied: number;
  cursor: number;
}

/**
 * Busca as notas de entrada novas de um tenant.
 *
 * Não lança para falha do provedor: a sincronização roda em cron e num webhook,
 * e uma indisponibilidade momentânea não pode virar erro visível — o próximo
 * ciclo pega o que faltou, porque o cursor só avança sobre o que foi gravado.
 */
export async function syncReceivedInvoices(tenantId: string): Promise<SyncResult> {
  const settings = await getFiscalSettings(tenantId);

  // A recepção é opt-in: sem a flag o provedor sequer busca as notas, e cada
  // uma que chegasse consumiria uma unidade do pacote mensal.
  if (!settings?.habilitaManifestacao) {
    return { fetched: 0, applied: 0, cursor: 0 };
  }

  const env = resolveFiscalEnvironment(settings.environment);
  const cursor = await readCursor(tenantId);

  try {
    const token = await getIssuingToken(tenantId, env);
    const items = (await focusFiscalProvider.listReceivedInvoices(
      env,
      token,
      cursor,
    )) as FocusReceivedSummary[];

    let applied = 0;
    for (const item of items) {
      try {
        if (await upsertReceivedInvoice(tenantId, item)) {
          applied += 1;
        }
      } catch (error) {
        // Uma nota malformada não pode travar o lote inteiro.
        logger.warn("Nota recebida ignorada", {
          tenantId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // O cursor só avança depois da gravação: se o processo morrer no meio, o
    // próximo ciclo refaz o lote em vez de pular notas.
    const highest = maxVersionOf(items);
    if (highest > cursor) {
      await writeCursor(tenantId, highest);
    }

    logger.info("Sincronizacao de notas de entrada concluida", {
      tenantId,
      recebidas: items.length,
      aplicadas: applied,
      cursor: Math.max(cursor, highest),
    });

    return { fetched: items.length, applied, cursor: Math.max(cursor, highest) };
  } catch (error) {
    const detail = describeFocusError(error);
    logger.error("Sincronizacao de notas de entrada falhou", {
      tenantId,
      codigo: detail.codigo,
      error: detail.message,
    });
    return { fetched: 0, applied: 0, cursor };
  }
}

export async function listReceivedInvoices(
  tenantId: string,
  options: { limit?: number } = {},
): Promise<ReceivedInvoiceDocument[]> {
  const snap = await db
    .collection(COLLECTION)
    .where("tenantId", "==", tenantId)
    .orderBy("dataEmissao", "desc")
    .limit(options.limit ?? 50)
    .get();

  return snap.docs.map((doc) => doc.data() as ReceivedInvoiceDocument);
}

export async function getReceivedInvoice(
  tenantId: string,
  chaveAcesso: string,
): Promise<ReceivedInvoiceDocument | null> {
  const snap = await db.collection(COLLECTION).doc(buildDocId(tenantId, chaveAcesso)).get();
  return snap.exists ? (snap.data() as ReceivedInvoiceDocument) : null;
}

/**
 * Registra a manifestação do destinatário perante a Receita.
 *
 * Nunca é automática: confirmar uma nota é uma declaração formal da empresa, e
 * desconhecer uma operação legítima tem consequência fiscal. A validação da
 * justificativa fica no controller, para o usuário ver o problema antes do
 * envio.
 *
 * Depois de confirmada, a nota é re-consultada — é a confirmação que libera o
 * XML completo com os itens, e é daí que sai o NCM que alimenta o catálogo.
 */
export async function manifestReceivedInvoice(
  tenantId: string,
  chaveAcesso: string,
  tipo: ManifestationType,
  justificativa?: string,
): Promise<ReceivedInvoiceDocument | null> {
  const settings = await getFiscalSettings(tenantId);
  if (!settings) {
    throw new Error("FISCAL_NAO_CONFIGURADO");
  }

  const stored = await getReceivedInvoice(tenantId, chaveAcesso);
  if (!stored) {
    throw new Error("NOTA_RECEBIDA_NAO_ENCONTRADA");
  }

  const env = resolveFiscalEnvironment(settings.environment);
  const token = await getIssuingToken(tenantId, env);

  await focusFiscalProvider.manifestReceivedInvoice(
    chaveAcesso,
    tipo,
    env,
    token,
    justificativa,
  );

  await db
    .collection(COLLECTION)
    .doc(buildDocId(tenantId, chaveAcesso))
    .set(
      {
        manifestacao: tipo,
        manifestadaEm: new Date().toISOString(),
        ...(justificativa ? { manifestacaoJustificativa: justificativa } : {}),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

  // A confirmação libera o XML completo — buscar de novo traz os itens.
  if (tipo === "confirmacao") {
    try {
      const full = (await focusFiscalProvider.getReceivedInvoice(
        chaveAcesso,
        env,
        token,
      )) as FocusReceivedSummary;
      await upsertReceivedInvoice(tenantId, { ...full, chave_nfe: chaveAcesso });
    } catch (error) {
      // A manifestação já foi registrada na Receita; buscar os itens é o passo
      // seguinte e o cron reencontra a nota.
      logger.warn("Nota confirmada, mas os itens ainda nao vieram", {
        tenantId,
        error: describeFocusError(error).message,
      });
    }
  }

  return getReceivedInvoice(tenantId, chaveAcesso);
}
