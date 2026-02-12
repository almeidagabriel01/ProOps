"use client";

import { db } from "@/lib/firebase";
import { callApi } from "@/lib/api-client";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  getDoc,
} from "firebase/firestore";

export type TransactionType = "income" | "expense";
export type TransactionStatus = "paid" | "pending" | "overdue";

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
  isInstallment?: boolean;
  installmentCount?: number; // Total number of installments
  installmentNumber?: number; // Current installment (1, 2, 3...)
  installmentGroupId?: string; // ID to group related installments
  notes?: string;
  createdAt: string;
  updatedAt: string;
  isPartialPayment?: boolean;
  parentTransactionId?: string; // ID of the transaction this was split from (or related to)
};

const COLLECTION_NAME = "transactions";

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
      const transactions = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Transaction[];

      // Sort by date descending (client-side)
      return transactions.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
    } catch (error) {
      console.error("Error fetching transactions:", error);
      throw error;
    }
  },

  getTransactionById: async (id: string): Promise<Transaction | null> => {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Transaction;
      }
      return null;
    } catch (error) {
      console.error("Error fetching transaction:", error);
      throw error;
    }
  },

  createTransaction: async (
    transaction: Omit<Transaction, "id">,
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
          isInstallment: transaction.isInstallment,
          installmentCount: transaction.installmentCount,
          installmentNumber: transaction.installmentNumber,
          installmentGroupId: transaction.installmentGroupId,
          notes: transaction.notes,
          targetTenantId: transaction.tenantId, // Pass tenantId to backend (for super admin)
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

  updateTransactionsStatusBatch: async (
    ids: string[],
    newStatus: TransactionStatus,
  ) => {
    try {
      await callApi("v1/transactions/status-batch", "POST", {
        ids,
        newStatus,
      });
      return true;
    } catch (error) {
      console.error("Error updating transactions status batch:", error);
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
      const transactions = await TransactionService.getTransactions(tenantId);

      const summary = {
        totalIncome: 0,
        totalExpense: 0,
        pendingIncome: 0,
        pendingExpense: 0,
      };

      transactions.forEach((t) => {
        if (t.type === "income") {
          if (t.status === "paid") {
            summary.totalIncome += t.amount;
          } else {
            summary.pendingIncome += t.amount;
          }
        } else {
          if (t.status === "paid") {
            summary.totalExpense += t.amount;
          } else {
            summary.pendingExpense += t.amount;
          }
        }
      });

      return summary;
    } catch (error) {
      console.error("Error getting summary:", error);
      throw error;
    }
  },
};
