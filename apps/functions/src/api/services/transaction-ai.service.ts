import { db } from "../../init";
import { Timestamp } from "firebase-admin/firestore";
import { randomUUID } from "crypto";
import { roundCurrency, addDateMonths } from "./transaction-helpers";
import { TransactionService } from "./transaction.service";

const COLLECTION_NAME = "transactions";

export interface TransactionListItem {
  id: string;
  description: string;
  amount: number;
  type: string;
  status: string;
  date: string;
  wallet: string;
  category: string;
}

export interface CreateTransactionForAiParams {
  type: "income" | "expense";
  description: string;
  amount: number;
  walletId: string;
  date: string; // YYYY-MM-DD
  category?: string;
  installments?: number;
  proposalId?: string;
}

export async function listTransactionsForAi(
  tenantId: string,
  opts?: {
    type?: string;
    walletId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    /** O alcance de Lançamentos: `type == income` ou `sellerId == uid`. */
    scope?: { field: "type" | "sellerId"; value: string };
  },
): Promise<TransactionListItem[]> {
  const maxLimit = Math.min(opts?.limit || 20, 100);

  let query: FirebaseFirestore.Query = db
    .collection(COLLECTION_NAME)
    .where("tenantId", "==", tenantId);

  if (opts?.scope) {
    // "Só receitas" pedindo despesas: nada a mostrar.
    if (opts.scope.field === "type" && opts.type && opts.type !== opts.scope.value) return [];
    if (!(opts.scope.field === "type" && opts.type)) query = query.where(opts.scope.field, "==", opts.scope.value);
  }

  if (opts?.type) {
    query = query.where("type", "==", opts.type);
  }

  if (opts?.walletId) {
    query = query.where("wallet", "==", opts.walletId);
  }

  if (opts?.startDate) {
    query = query.where("date", ">=", opts.startDate);
  }

  if (opts?.endDate) {
    query = query.where("date", "<=", opts.endDate);
  }

  query = query.orderBy("date", "desc").limit(maxLimit);

  const snap = await query.get();

  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      description: data.description || "",
      amount: data.amount || 0,
      type: data.type || "",
      status: data.status || "",
      date: data.date || "",
      wallet: data.wallet || "",
      category: data.category || "",
    };
  });
}

export async function createTransactionForAi(
  params: CreateTransactionForAiParams,
  tenantId: string,
  uid: string,
): Promise<{ id: string; description: string; amount: number; status: string }> {
  // Carteira e proposta vêm do modelo: as duas têm que ser da empresa, senão
  // o lançamento apontaria para a carteira (ou a proposta) de outra.
  const walletSnap = await db.collection("wallets").doc(params.walletId).get();
  if (!walletSnap.exists || walletSnap.data()?.tenantId !== tenantId) {
    throw new Error("Carteira não encontrada nesta empresa.");
  }
  if (params.proposalId) {
    const proposalSnap = await db.collection("proposals").doc(params.proposalId).get();
    if (!proposalSnap.exists || proposalSnap.data()?.tenantId !== tenantId) {
      throw new Error("Proposta não encontrada nesta empresa.");
    }
  }

  const now = Timestamp.now();
  const installments = params.installments && params.installments > 1 ? params.installments : 1;

  if (installments === 1) {
    const txRef = db.collection(COLLECTION_NAME).doc();
    const txData: Record<string, unknown> = {
      tenantId,
      type: params.type,
      description: params.description,
      amount: roundCurrency(params.amount),
      status: "pending",
      date: params.date,
      wallet: params.walletId,
      category: params.category || "",
      createdById: uid,
      createdAt: now,
      updatedAt: now,
    };

    if (params.proposalId) txData.proposalId = params.proposalId;

    await txRef.set(txData);

    return {
      id: txRef.id,
      description: params.description,
      amount: roundCurrency(params.amount),
      status: "pending",
    };
  }

  // Multi-installment: create multiple docs atomically
  const installmentGroupId = randomUUID();
  const batch = db.batch();
  const perInstallment = roundCurrency(params.amount / installments);
  let firstId = "";

  for (let i = 1; i <= installments; i++) {
    const isLast = i === installments;
    const totalSoFar = roundCurrency(perInstallment * (installments - 1));
    const installmentAmount = isLast
      ? roundCurrency(params.amount - totalSoFar)
      : perInstallment;

    // Each installment date advances by 1 month from the base date
    const installmentDate = addDateMonths(params.date, i - 1);

    const txRef = db.collection(COLLECTION_NAME).doc();
    if (i === 1) firstId = txRef.id;

    const txData: Record<string, unknown> = {
      tenantId,
      type: params.type,
      description: `${params.description} (${i}/${installments})`,
      amount: installmentAmount,
      status: "pending",
      date: installmentDate,
      wallet: params.walletId,
      category: params.category || "",
      isInstallment: true,
      installmentGroupId,
      installmentNumber: i,
      installmentCount: installments,
      createdById: uid,
      createdAt: now,
      updatedAt: now,
    };

    if (params.proposalId) txData.proposalId = params.proposalId;

    batch.set(txRef, txData);
  }

  await batch.commit();

  return {
    id: firstId,
    description: params.description,
    amount: roundCurrency(params.amount),
    status: "pending",
  };
}

/** Quem pediu à Lia: o mesmo contexto que a request HTTP teria. */
export interface AiFinanceActor {
  uid: string;
  role: string;
  tenantId: string;
}

function actorClaims(actor: AiFinanceActor) {
  return { uid: actor.uid, role: String(actor.role || "").toUpperCase(), tenantId: actor.tenantId };
}

/**
 * Excluir pela Lia passa pelo MESMO `TransactionService.deleteTransaction` da
 * tela: ele estorna o saldo da carteira de um lançamento pago, recusa o
 * lançamento de proposta aprovada e confere a permissão. Até 2026-10 a Lia
 * apagava o documento direto, e um lançamento pago sumia deixando o saldo da
 * carteira errado em silêncio.
 */
export async function deleteTransactionForAi(
  transactionId: string,
  actor: AiFinanceActor,
): Promise<{ id: string; deleted: boolean }> {
  await TransactionService.deleteTransaction(actor.uid, actorClaims(actor), transactionId);
  return { id: transactionId, deleted: true };
}

/**
 * Pagar uma parcela pela Lia passa pelo `TransactionService.updateTransaction`,
 * que move o saldo e grava `paidAt` como a tela. A versão anterior lia a
 * carteira depois de gravar dentro da transação (o Firestore recusa) e
 * gravava `paidAt` como texto.
 */
export async function payInstallmentForAi(
  transactionId: string,
  installmentNumber: number,
  actor: AiFinanceActor,
  paidAt?: string,
): Promise<{ id: string; installmentNumber: number; status: string }> {
  const snap = await db.collection(COLLECTION_NAME).doc(transactionId).get();
  if (!snap.exists) {
    throw new Error("Transação não encontrada.");
  }
  const data = snap.data()!;
  if (data.tenantId !== actor.tenantId) {
    throw new Error("Transação não pertence a este tenant.");
  }
  if (!data.isInstallment) {
    throw new Error("Esta transação não é uma parcela.");
  }
  if (data.installmentNumber !== installmentNumber) {
    throw new Error(
      `Número de parcela não coincide: esperado ${data.installmentNumber}, recebido ${installmentNumber}.`,
    );
  }
  if (data.status === "paid") {
    throw new Error("Parcela ja esta paga.");
  }

  await TransactionService.updateTransaction(actor.uid, actorClaims(actor), transactionId, {
    status: "paid",
  });

  // Data de pagamento informada (dd/MM/yyyy já convertida): meio-dia no
  // horário de Brasília, para não virar o dia anterior no UTC.
  if (paidAt && /^\d{4}-\d{2}-\d{2}$/.test(paidAt)) {
    await db
      .collection(COLLECTION_NAME)
      .doc(transactionId)
      .update({ paidAt: Timestamp.fromDate(new Date(`${paidAt}T12:00:00-03:00`)) });
  }

  return { id: transactionId, installmentNumber, status: "paid" };
}
