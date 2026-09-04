/**
 * Ponte entre a nota de entrada e o módulo financeiro.
 *
 * A nota do fornecedor **já é** a despesa: o valor, a data e quem cobrou estão
 * todos nela. Redigitar isso é trabalho que o sistema pode poupar.
 *
 * Mas nunca automático. Quem compra costuma **já ter lançado a compra à mão**
 * quando pagou o fornecedor — e lançar de novo não é um registro a mais, é o
 * saldo da carteira errado. Por isso: só sob clique, e com aviso quando existe
 * despesa parecida no período.
 */

import { db } from "../../../init";
import { logger } from "../../../lib/logger";
import { TransactionService } from "../transaction.service";
import { brasiliaDatePart } from "./fiscal-datetime";
import { getReceivedInvoice } from "./received-invoice.service";
import type { ReceivedInvoiceDocument } from "./received-invoice.types";

const COLLECTION = "received_invoices";

/**
 * Janela de busca por despesa parecida.
 *
 * Larga de propósito: o lançamento manual costuma ser feito no dia do
 * PAGAMENTO, que raramente é o da emissão da nota — boleto de fornecedor vence
 * em 28 ou 30 dias. Uma janela curta não acharia justamente o caso comum.
 */
const DUPLICATE_WINDOW_DAYS = 45;
/** Teto de leitura: a janela pode pegar muitos lançamentos num tenant ativo. */
const DUPLICATE_SCAN_LIMIT = 300;
/** Centavos de folga — o mesmo valor pode ter sido digitado com arredondamento. */
const AMOUNT_TOLERANCE = 0.02;

export interface DuplicateCandidate {
  id: string;
  description: string;
  amount: number;
  date: string;
}

export type LaunchOutcome =
  | { outcome: "created"; invoice: ReceivedInvoiceDocument; transactionId: string }
  | { outcome: "already_launched"; transactionId: string }
  | { outcome: "needs_confirmation"; candidates: DuplicateCandidate[] };

function shiftDays(iso: string, days: number): string {
  const base = new Date(`${iso}T12:00:00-03:00`);
  base.setDate(base.getDate() + days);
  return brasiliaDatePart(base.toISOString());
}

/**
 * Despesas de valor equivalente na janela ao redor da nota.
 *
 * Casa por VALOR e período, não por fornecedor: o lançamento manual raramente
 * traz o nome exato que vem na nota — quem digita escreve "material obra" ou o
 * apelido do fornecedor, não a razão social. Casar por nome não acharia quase
 * nada e daria a falsa sensação de que não há duplicata.
 */
async function findDuplicateCandidates(
  tenantId: string,
  invoice: ReceivedInvoiceDocument,
  referenceDate: string,
): Promise<DuplicateCandidate[]> {
  const snap = await db
    .collection("transactions")
    .where("tenantId", "==", tenantId)
    .where("type", "==", "expense")
    .where("date", ">=", shiftDays(referenceDate, -DUPLICATE_WINDOW_DAYS))
    .where("date", "<=", shiftDays(referenceDate, DUPLICATE_WINDOW_DAYS))
    .limit(DUPLICATE_SCAN_LIMIT)
    .get();

  const candidatos: DuplicateCandidate[] = [];
  for (const doc of snap.docs) {
    const data = doc.data() as Record<string, unknown>;
    const amount = Number(data.amount ?? 0);
    if (Math.abs(amount - invoice.valorTotal) > AMOUNT_TOLERANCE) continue;
    candidatos.push({
      id: doc.id,
      description: String(data.description ?? ""),
      amount,
      date: String(data.date ?? ""),
    });
  }
  return candidatos;
}

function buildDescription(invoice: ReceivedInvoiceDocument): string {
  const fornecedor = invoice.emitenteNome?.trim() || invoice.emitenteCnpj;
  const nota = invoice.numero ? ` — nota ${invoice.numero}` : "";
  return `${fornecedor}${nota}`;
}

export async function createTransactionFromReceivedInvoice(
  tenantId: string,
  chave: string,
  userId: string,
  user: unknown,
  options: { force?: boolean; wallet?: string; category?: string } = {},
): Promise<LaunchOutcome> {
  const invoice = await getReceivedInvoice(tenantId, chave);
  if (!invoice) {
    throw new Error("NOTA_RECEBIDA_NAO_ENCONTRADA");
  }
  // Uma nota gera UM lançamento. Sem esta guarda, dois cliques seguidos —
  // ou dois usuários na mesma tela — duplicariam a despesa em silêncio.
  if (invoice.transactionId) {
    return { outcome: "already_launched", transactionId: invoice.transactionId };
  }
  if (invoice.status === "cancelada") {
    throw new Error("NOTA_CANCELADA_NAO_VIRA_DESPESA");
  }

  const data = invoice.dataEmissao
    ? brasiliaDatePart(invoice.dataEmissao)
    : brasiliaDatePart(new Date().toISOString());

  if (!options.force) {
    const candidates = await findDuplicateCandidates(tenantId, invoice, data);
    if (candidates.length > 0) {
      return { outcome: "needs_confirmation", candidates };
    }
  }

  // Passa pelo TransactionService e não escreve direto: é ele que valida a
  // permissão financeira, ajusta saldo de carteira em transação atômica e
  // dispara o trigger de totais. Escrever o doc na mão pularia os três.
  const created = await TransactionService.createTransaction(userId, user, {
    description: buildDescription(invoice),
    amount: invoice.valorTotal,
    date: data,
    dueDate: data,
    type: "expense",
    status: "pending",
    // Nome sem `clientId`: o fornecedor pode não estar cadastrado, e criar um
    // contato por conta própria seria efeito colateral que ninguém pediu.
    clientName: invoice.emitenteNome?.trim() || invoice.emitenteCnpj,
    ...(options.wallet ? { wallet: options.wallet } : {}),
    ...(options.category ? { category: options.category } : {}),
    notes: `Gerado da nota de entrada ${invoice.chaveAcesso}`,
  });

  const transactionId = created?.transactionId;
  if (!transactionId) {
    throw new Error("LANCAMENTO_SEM_ID");
  }

  const now = new Date().toISOString();
  await db
    .collection(COLLECTION)
    .doc(invoice.id)
    .update({ transactionId, updatedAt: now });

  logger.info("Lançamento criado a partir de nota de entrada", {
    tenantId,
    chave: invoice.chaveAcesso,
    transactionId,
    forcado: options.force === true,
  });

  return {
    outcome: "created",
    invoice: { ...invoice, transactionId, updatedAt: now },
    transactionId,
  };
}
