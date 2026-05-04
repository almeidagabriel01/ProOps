import { db } from "../../init";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { randomUUID } from "crypto";
import { roundCurrency, addDateMonths } from "./transaction-helpers";

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
  },
): Promise<TransactionListItem[]> {
  const maxLimit = Math.min(opts?.limit || 20, 100);

  let query: FirebaseFirestore.Query = db
    .collection(COLLECTION_NAME)
    .where("tenantId", "==", tenantId);

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

export async function deleteTransactionForAi(
  transactionId: string,
  tenantId: string,
): Promise<{ id: string; deleted: boolean }> {
  const snap = await db.collection(COLLECTION_NAME).doc(transactionId).get();

  if (!snap.exists) {
    throw new Error("Transação não encontrada.");
  }

  const data = snap.data()!;

  if (data.tenantId !== tenantId) {
    throw new Error("Transação não pertence a este tenant.");
  }

  await db.collection(COLLECTION_NAME).doc(transactionId).delete();

  return { id: transactionId, deleted: true };
}

export async function payInstallmentForAi(
  transactionId: string,
  installmentNumber: number,
  tenantId: string,
  paidAt?: string,
): Promise<{ id: string; installmentNumber: number; status: string }> {
  await db.runTransaction(async (t) => {
    const ref = db.collection(COLLECTION_NAME).doc(transactionId);
    const snap = await t.get(ref);

    if (!snap.exists) {
      throw new Error("Transação não encontrada.");
    }

    const data = snap.data()!;

    if (data.tenantId !== tenantId) {
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

    const now = Timestamp.now();
    const update: Record<string, unknown> = {
      status: "paid",
      paidAt: paidAt || now.toDate().toISOString(),
      updatedAt: now,
    };

    t.update(ref, update);

    // Update wallet balance if wallet is set
    if (data.wallet && data.amount) {
      const walletSnap = await db
        .collection("wallets")
        .where("tenantId", "==", tenantId)
        .where("name", "==", data.wallet)
        .limit(1)
        .get();

      // Also try by ID
      const walletByIdSnap = await t.get(
        db.collection("wallets").doc(data.wallet as string),
      );

      let walletRef: FirebaseFirestore.DocumentReference | null = null;

      if (walletByIdSnap.exists && walletByIdSnap.data()?.tenantId === tenantId) {
        walletRef = walletByIdSnap.ref;
      } else if (!walletSnap.empty) {
        walletRef = walletSnap.docs[0].ref;
      }

      if (walletRef) {
        const delta = data.type === "income" ? data.amount : -(data.amount as number);
        t.update(walletRef, {
          balance: FieldValue.increment(delta),
          updatedAt: now,
        });
      }
    }
  });

  return { id: transactionId, installmentNumber, status: "paid" };
}
