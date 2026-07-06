"use client";

import { db } from "@/lib/firebase";
import { callApi } from "@/lib/api-client";
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  getDoc,
} from "firebase/firestore";
import type { QueryDocumentSnapshot } from "firebase/firestore";

export type TransactionType = "income" | "expense";
export type TransactionStatus = "paid" | "pending" | "overdue";

export type DownPaymentInput = {
  amount: number;
  date: string;
  dueDate?: string;
  wallet?: string;
  status: TransactionStatus;
  downPaymentType?: string;
  downPaymentPercentage?: number;
  installmentNumber?: number;
  installmentCount?: number;
  paymentMode?: "total" | "installmentValue";
  notes?: string;
};

export type CreateTransactionInput = Omit<Transaction, "id"> & {
  downPayment?: DownPaymentInput;
};

export type ExtraCost = {
  id: string;
  amount: number;
  description: string;
  status: TransactionStatus;
  wallet?: string;
  createdAt: string;
  parentTransactionId?: string;
};

export type Transaction = {
  id: string;
  tenantId: string;
  type: TransactionType;
  description: string;
  amount: number;
  date: string;
  dueDate?: string;
  status: TransactionStatus;
  clientId?: string;
  clientName?: string;
  proposalId?: string;
  proposalGroupId?: string; // ID to group down payment + installments from same proposal
  category?: string;
  wallet?: string; // Payment method: NuBank, PicPay, Boleto, etc.
  isDownPayment?: boolean; // True if this is a down payment entry
  downPaymentType?: "value" | "percentage";
  downPaymentPercentage?: number;
  isInstallment?: boolean;
  installmentCount?: number; // Total number of installments
  installmentNumber?: number; // Current installment (1, 2, 3...)
  installmentGroupId?: string; // ID to group related installments
  installmentInterval?: number; // Interval between installments in months
  isRecurring?: boolean; // True if this transaction is part of a recurring series
  recurringGroupId?: string; // ID to group recurring transactions
  paymentMode?: "total" | "installmentValue"; // The UI mode used to create this transaction
  notes?: string;
  createdAt: string;
  updatedAt: string;
  isPartialPayment?: boolean;
  overriddenAmount?: boolean;
  parentTransactionId?: string; // ID of the transaction this was split from (or related to)
  extraCosts?: ExtraCost[]; // Inline extra costs that don't need their own transaction documents
  paidAt?: string; // Timestamp set when transaction is marked as paid
};

export type UpdateFinancialEntryWithInstallmentsPayload = {
  type: TransactionType;
  description: string;
  amount: string;
  date: string;
  dueDate: string;
  status: TransactionStatus;
  clientId?: string;
  clientName?: string;
  category?: string;
  wallet?: string;
  notes?: string;
  isInstallment: boolean;
  installmentCount: number;
  installmentInterval?: number;
  isRecurring?: boolean;
  paymentMode: "total" | "installmentValue";
  installmentValue: string;
  firstInstallmentDate: string;
  installmentsWallet: string;
  downPaymentEnabled: boolean;
  downPaymentType: "value" | "percentage";
  downPaymentPercentage: string;
  downPaymentValue: string;
  downPaymentWallet: string;
  downPaymentDueDate: string;
  expectedUpdatedAt?: string | number;
  targetTenantId?: string;
  extraTransactionIds?: string[];
};

const COLLECTION_NAME = "transactions";
const GROUPS_COLLECTION_NAME = "transaction_groups";

/**
 * Doc-resumo de transaction_groups (espelho do tipo backend em
 * apps/functions/src/lib/transaction-group-summary.ts) + id do doc.
 * Mantido pelo trigger onTransactionTotals — client só lê (rules negam write).
 */
export type TransactionGroupSummary = {
  id: string;
  tenantId: string;
  groupKey: string; // "proposal:{id}" | "group:{id}"
  kind: "proposal" | "installment" | "recurring";
  type: TransactionType;
  description: string;
  wallet?: string;
  clientName?: string;
  proposalId?: string;
  memberCount: number;
  paidCount: number;
  total: number;
  paidTotal: number;
  pendingTotal: number;
  nextDueDate: string | null;
  firstDueDate: string | null;
  lastDueDate: string | null;
  status: TransactionStatus;
  updatedAt: string;
  /** id do doc âncora — permite links/ações no card colapsado sem carregar membros */
  anchorTransactionId?: string;
  /** amount do âncora — exibição de recorrentes (valor por ocorrência, não Σ) */
  anchorAmount?: number;
  /** installmentGroupId do âncora — delete/status de grupo em resumos kind proposal */
  anchorInstallmentGroupId?: string;
};

const DEFAULT_GROUPS_PAGE_SIZE = 50;

/**
 * Derives `overdue` for pending transactions whose dueDate already passed.
 * The cron `markOverdueTransactions` (00:05 BRT) persists this state daily;
 * deriving on read covers the gap so users never see a stale "Pendente" on
 * a vencida lançamento. Returns a new object — does not mutate input.
 */
export function withDerivedOverdue<T extends { status?: TransactionStatus; dueDate?: string }>(
  tx: T,
): T {
  if (tx.status !== "pending" || !tx.dueDate) return tx;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${tx.dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return tx;
  if (due >= today) return tx;
  return { ...tx, status: "overdue" as TransactionStatus };
}

export const TransactionService = {
  getTransactions: async (tenantId: string): Promise<Transaction[]> => {
    try {
      // Note: Not using orderBy to avoid needing a composite index
      // Sorting is done client-side instead
      const q = query(
        collection(db, COLLECTION_NAME),
        where("tenantId", "==", tenantId),
      );
      const querySnapshot = await getDocs(q);
      const transactions = querySnapshot.docs.map((doc) => {
        const data = { id: doc.id, ...doc.data() } as Transaction;
        return withDerivedOverdue(data);
      });

      // Sort by date descending (client-side)
      return transactions.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
    } catch (error) {
      console.error("Error fetching transactions:", error);
      throw error;
    }
  },

  /**
   * Busca escopada — substitui o full-fetch da página financeira.
   *
   * Escopo = união de 3 queries baratas (dedupe por id):
   *  1. itens em aberto (pending/overdue) — dívida ativa, naturalmente pequena
   *     e SEMPRE completa, independente do período;
   *  2. docs com dueDate dentro do período visível;
   *  3. docs com date dentro do período (cobre docs antigos sem dueDate).
   *
   * Grupos parciais (parcela no período, irmãs fora) são completados via
   * completeTransactionGroups — a visualização agrupada nunca mostra grupo
   * pela metade.
   */
  getTransactionsScoped: async (
    tenantId: string,
    period: { start: string; end: string },
  ): Promise<Transaction[]> => {
    try {
      const col = collection(db, COLLECTION_NAME);
      const [openSnap, dueSnap, dateSnap] = await Promise.all([
        getDocs(
          query(
            col,
            where("tenantId", "==", tenantId),
            where("status", "in", ["pending", "overdue"]),
          ),
        ),
        getDocs(
          query(
            col,
            where("tenantId", "==", tenantId),
            where("dueDate", ">=", period.start),
            where("dueDate", "<=", period.end),
          ),
        ),
        getDocs(
          query(
            col,
            where("tenantId", "==", tenantId),
            where("date", ">=", period.start),
            where("date", "<=", period.end),
          ),
        ),
      ]);

      const byId = new Map<string, Transaction>();
      for (const snap of [openSnap, dueSnap, dateSnap]) {
        snap.docs.forEach((docSnap) => {
          byId.set(
            docSnap.id,
            withDerivedOverdue({ id: docSnap.id, ...docSnap.data() } as Transaction),
          );
        });
      }

      const scoped = Array.from(byId.values());
      const completed = await TransactionService.completeTransactionGroups(
        tenantId,
        scoped,
      );

      return completed.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
    } catch (error) {
      console.error("Error fetching scoped transactions:", error);
      throw error;
    }
  },

  /**
   * Garante grupos íntegros: para cada installmentGroupId/recurringGroupId
   * presente na lista, busca os membros faltantes em chunks de `in` (30 ids).
   */
  completeTransactionGroups: async (
    tenantId: string,
    transactions: Transaction[],
  ): Promise<Transaction[]> => {
    const byId = new Map(transactions.map((t) => [t.id, t]));

    const collectGroupIds = (field: "installmentGroupId" | "recurringGroupId") =>
      Array.from(
        new Set(
          transactions
            .map((t) => t[field])
            .filter((g): g is string => typeof g === "string" && g.length > 0),
        ),
      );

    const fetchGroups = async (
      field: "installmentGroupId" | "recurringGroupId",
      groupIds: string[],
    ) => {
      const CHUNK = 30; // limite de disjunções do operador "in"
      for (let i = 0; i < groupIds.length; i += CHUNK) {
        const chunk = groupIds.slice(i, i + CHUNK);
        const snap = await getDocs(
          query(
            collection(db, COLLECTION_NAME),
            where("tenantId", "==", tenantId),
            where(field, "in", chunk),
          ),
        );
        snap.docs.forEach((docSnap) => {
          if (!byId.has(docSnap.id)) {
            byId.set(
              docSnap.id,
              withDerivedOverdue({ id: docSnap.id, ...docSnap.data() } as Transaction),
            );
          }
        });
      }
    };

    await Promise.all([
      fetchGroups("installmentGroupId", collectGroupIds("installmentGroupId")),
      fetchGroups("recurringGroupId", collectGroupIds("recurringGroupId")),
    ]);

    return Array.from(byId.values());
  },

  getTransactionById: async (id: string): Promise<Transaction | null> => {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return withDerivedOverdue({ id: docSnap.id, ...docSnap.data() } as Transaction);
      }
      return null;
    } catch (error) {
      console.error("Error fetching transaction:", error);
      throw error;
    }
  },

  createTransaction: async (
    transaction: CreateTransactionInput,
  ): Promise<Transaction> => {
    try {
      const result = await callApi<{ success: boolean; transactionId: string }>(
        "v1/transactions",
        "POST",
        {
          type: transaction.type,
          description: transaction.description,
          amount: transaction.amount,
          date: transaction.date,
          dueDate: transaction.dueDate,
          status: transaction.status,
          clientId: transaction.clientId,
          clientName: transaction.clientName,
          proposalId: transaction.proposalId,
          category: transaction.category,
          wallet: transaction.wallet,
          isDownPayment: transaction.isDownPayment,
          downPaymentType: transaction.downPaymentType,
          downPaymentPercentage: transaction.downPaymentPercentage,
          isInstallment: transaction.isInstallment,
          isRecurring: transaction.isRecurring,
          installmentCount: transaction.installmentCount,
          installmentNumber: transaction.installmentNumber,
          installmentGroupId: transaction.installmentGroupId,
          recurringGroupId: transaction.recurringGroupId,
          installmentInterval: transaction.installmentInterval,
          paymentMode: transaction.paymentMode,
          notes: transaction.notes,
          targetTenantId: transaction.tenantId, // Pass tenantId to backend (for super admin)
          downPayment: transaction.downPayment,
        },
      );

      return {
        id: result.transactionId,
        ...transaction,
      } as Transaction;
    } catch (error) {
      console.error("Error creating transaction:", error);
      throw error;
    }
  },

  updateTransaction: async (
    id: string,
    updates: Partial<Omit<Transaction, "id">>,
  ) => {
    try {
      await callApi(`v1/transactions/${id}`, "PUT", updates);
      return { id, ...updates };
    } catch (error) {
      console.error("Error updating transaction:", error);
      throw error;
    }
  },

  updateFinancialEntryWithInstallments: async (
    id: string,
    payload: UpdateFinancialEntryWithInstallmentsPayload,
  ) => {
    try {
      await callApi(`v1/transactions/${id}/installments`, "PUT", payload);
      return true;
    } catch (error) {
      console.error("Error updating entry with installments:", error);
      throw error;
    }
  },

  updateTransactionsStatusBatch: async (
    ids: string[],
    newStatus: TransactionStatus,
  ) => {
    try {
      await callApi("v1/transactions/status-batch", "POST", { ids, newStatus });
      return true;
    } catch (error) {
      console.error("Error updating transactions status batch:", error);
      throw error;
    }
  },

  updateTransactionsBatch: async (
    updates: Array<{ id: string; data: Partial<Omit<Transaction, "id">> }>,
  ) => {
    try {
      await callApi("v1/transactions/batch", "PUT", { updates });
      return true;
    } catch (error) {
      console.error("Error updating transactions batch:", error);
      throw error;
    }
  },

  updateGroupStatus: async (groupId: string, newStatus: TransactionStatus) => {
    try {
      await callApi(`v1/transactions/group/${groupId}/status`, "PUT", { newStatus });
      return true;
    } catch (error) {
      console.error("Error updating group status:", error);
      throw error;
    }
  },

  deleteTransaction: async (id: string) => {
    try {
      await callApi(`v1/transactions/${id}`, "DELETE");
      return true;
    } catch (error) {
      console.error("Error deleting transaction:", error);
      throw error;
    }
  },

  deleteTransactionGroup: async (groupId: string) => {
    try {
      await callApi(`v1/transactions/group/${groupId}`, "DELETE");
      return true;
    } catch (error) {
      console.error("Error deleting transaction group:", error);
      throw error;
    }
  },

  registerPartialPayment: async (id: string, amount: number, date: string) => {
    try {
      await callApi(`v1/transactions/${id}/partial-payment`, "POST", { amount, date });
      return true;
    } catch (error) {
      console.error("Error registering partial payment:", error);
      throw error;
    }
  },

  getInstallmentsByGroupId: async (
    groupId: string,
    tenantId?: string,
  ): Promise<Transaction[]> => {
    try {
      const constraints = [where("installmentGroupId", "==", groupId)];
      if (tenantId) {
        constraints.push(where("tenantId", "==", tenantId));
      }
      const q = query(collection(db, COLLECTION_NAME), ...constraints);
      const querySnapshot = await getDocs(q);
      const transactions = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Transaction[];

      return transactions.sort(
        (a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0),
      );
    } catch (error) {
      console.error("Error fetching installments by group:", error);
      throw error;
    }
  },

  getRecurringByGroupId: async (
    groupId: string,
    tenantId?: string,
  ): Promise<Transaction[]> => {
    try {
      const constraints = [where("recurringGroupId", "==", groupId)];
      if (tenantId) {
        constraints.push(where("tenantId", "==", tenantId));
      }
      const q = query(collection(db, COLLECTION_NAME), ...constraints);
      const querySnapshot = await getDocs(q);
      const transactions = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Transaction[];

      return transactions.sort(
        (a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0),
      );
    } catch (error) {
      console.error("Error fetching recurring transactions by group:", error);
      throw error;
    }
  },

  /**
   * Docs pagos no intervalo [start, end) por `paidAt` — cobre o caso de
   * pagamento neste mês de lançamento antigo (date/dueDate fora da janela do
   * escopo). Docs legados sem paidAt têm date/dueDate antigos e caem fora dos
   * gráficos (que começam no mês atual) — sem perda visível.
   */
  getTransactionsPaidBetween: async (
    tenantId: string,
    startIso: string,
    endIso: string,
  ): Promise<Transaction[]> => {
    try {
      const snap = await getDocs(
        query(
          collection(db, COLLECTION_NAME),
          where("tenantId", "==", tenantId),
          where("paidAt", ">=", startIso),
          where("paidAt", "<", endIso),
        ),
      );
      return snap.docs.map(
        (docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as Transaction,
      );
    } catch (error) {
      console.error("Error fetching paid transactions:", error);
      throw error;
    }
  },

  /** Últimos N lançamentos por date desc — atividade recente do dashboard. */
  getRecentTransactions: async (
    tenantId: string,
    count = 5,
  ): Promise<Transaction[]> => {
    try {
      const snap = await getDocs(
        query(
          collection(db, COLLECTION_NAME),
          where("tenantId", "==", tenantId),
          orderBy("date", "desc"),
          limit(count),
        ),
      );
      return snap.docs.map((docSnap) =>
        withDerivedOverdue({ id: docSnap.id, ...docSnap.data() } as Transaction),
      );
    } catch (error) {
      console.error("Error fetching recent transactions:", error);
      throw error;
    }
  },

  /**
   * Resumos de grupo paginados — fonte da aba Agrupados. Ordena por
   * lastDueDate desc (inclui grupos 100% pagos; nextDueDate null sumiria do
   * orderBy). nextCursor null = última página.
   */
  getGroupSummariesPaginated: async (
    tenantId: string,
    opts: {
      pageSize?: number;
      cursor?: QueryDocumentSnapshot | null;
    } = {},
  ): Promise<{
    groups: TransactionGroupSummary[];
    nextCursor: QueryDocumentSnapshot | null;
  }> => {
    try {
      const pageSize = opts.pageSize ?? DEFAULT_GROUPS_PAGE_SIZE;
      const constraints = [
        where("tenantId", "==", tenantId),
        orderBy("lastDueDate", "desc"),
        ...(opts.cursor ? [startAfter(opts.cursor)] : []),
        limit(pageSize),
      ];
      const snap = await getDocs(
        query(collection(db, GROUPS_COLLECTION_NAME), ...constraints),
      );
      const groups = snap.docs.map(
        (docSnap) =>
          ({ id: docSnap.id, ...docSnap.data() }) as TransactionGroupSummary,
      );
      const nextCursor =
        snap.docs.length === pageSize
          ? (snap.docs[snap.docs.length - 1] as QueryDocumentSnapshot)
          : null;
      return { groups, nextCursor };
    } catch (error) {
      console.error("Error fetching group summaries:", error);
      throw error;
    }
  },

  /**
   * Avulsos paginados (grouped == false), por date desc — `date` é sempre
   * presente; orderBy em dueDate excluiria docs antigos sem o campo.
   */
  getStandaloneTransactionsPaginated: async (
    tenantId: string,
    opts: {
      pageSize?: number;
      cursor?: QueryDocumentSnapshot | null;
    } = {},
  ): Promise<{
    transactions: Transaction[];
    nextCursor: QueryDocumentSnapshot | null;
  }> => {
    try {
      const pageSize = opts.pageSize ?? DEFAULT_GROUPS_PAGE_SIZE;
      const constraints = [
        where("tenantId", "==", tenantId),
        where("grouped", "==", false),
        orderBy("date", "desc"),
        ...(opts.cursor ? [startAfter(opts.cursor)] : []),
        limit(pageSize),
      ];
      const snap = await getDocs(
        query(collection(db, COLLECTION_NAME), ...constraints),
      );
      const transactions = snap.docs.map((docSnap) =>
        withDerivedOverdue({ id: docSnap.id, ...docSnap.data() } as Transaction),
      );
      const nextCursor =
        snap.docs.length === pageSize
          ? (snap.docs[snap.docs.length - 1] as QueryDocumentSnapshot)
          : null;
      return { transactions, nextCursor };
    } catch (error) {
      console.error("Error fetching standalone transactions:", error);
      throw error;
    }
  },

  /**
   * Membros de um grupo, on-demand (expandir container). Chave proposal
   * inclui irmãos legados do mesmo installmentGroupId sem proposalGroupId —
   * espelha o doc-resumo mantido pelo trigger.
   */
  getGroupMembers: async (
    tenantId: string,
    groupKey: string,
  ): Promise<Transaction[]> => {
    try {
      const byId = new Map<string, Transaction>();
      const collect = (docs: Transaction[]) => {
        for (const tx of docs) {
          if (!byId.has(tx.id)) byId.set(tx.id, withDerivedOverdue(tx));
        }
      };

      if (groupKey.startsWith("proposal:")) {
        const proposalGroupId = groupKey.slice("proposal:".length);
        const baseSnap = await getDocs(
          query(
            collection(db, COLLECTION_NAME),
            where("tenantId", "==", tenantId),
            where("proposalGroupId", "==", proposalGroupId),
          ),
        );
        collect(
          baseSnap.docs.map(
            (d) => ({ id: d.id, ...d.data() }) as Transaction,
          ),
        );
        const instIds = Array.from(
          new Set(
            Array.from(byId.values())
              .map((t) => t.installmentGroupId)
              .filter((g): g is string => typeof g === "string" && g.length > 0),
          ),
        );
        for (const instId of instIds) {
          collect(
            await TransactionService.getInstallmentsByGroupId(instId, tenantId),
          );
        }
      } else {
        const groupId = groupKey.startsWith("group:")
          ? groupKey.slice("group:".length)
          : groupKey;
        const [installments, recurring] = await Promise.all([
          TransactionService.getInstallmentsByGroupId(groupId, tenantId),
          TransactionService.getRecurringByGroupId(groupId, tenantId),
        ]);
        collect(installments);
        collect(recurring);
      }

      return Array.from(byId.values()).sort((a, b) => {
        const byNumber =
          (a.installmentNumber || 0) - (b.installmentNumber || 0);
        if (byNumber !== 0) return byNumber;
        return (a.dueDate || a.date || "").localeCompare(b.dueDate || b.date || "");
      });
    } catch (error) {
      console.error("Error fetching group members:", error);
      throw error;
    }
  },

  // Get summary for dashboard
  getSummary: async (
    tenantId: string,
  ): Promise<{
    totalIncome: number;
    totalExpense: number;
    pendingIncome: number;
    pendingExpense: number;
  }> => {
    try {
      // Summary agregado no backend (aggregation queries sobre os campos
      // desnormalizados paidTotal/pendingTotal) — o cálculo antigo baixava a
      // coleção INTEIRA do tenant no browser a cada page load. O tenantId vai
      // como query param: ignorado para não-superadmin (backend usa o do auth
      // context), usado pelo superadmin em impersonation.
      const response = await callApi<{
        success: boolean;
        summary: {
          totalIncome: number;
          totalExpense: number;
          pendingIncome: number;
          pendingExpense: number;
        };
      }>(
        `v1/transactions/summary?tenantId=${encodeURIComponent(tenantId)}`,
        "GET",
      );
      return response.summary;
    } catch (error) {
      console.error("Error getting summary:", error);
      throw error;
    }
  },
};
