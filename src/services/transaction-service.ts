"use client";

import { db } from "@/lib/firebase";
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    query,
    where,
    getDoc,
} from "firebase/firestore";

export type TransactionType = 'income' | 'expense';
export type TransactionStatus = 'paid' | 'pending' | 'overdue';

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
    category?: string;
    wallet?: string; // Payment method: NuBank, PicPay, Boleto, etc.
    isInstallment?: boolean;
    installmentCount?: number; // Total number of installments
    installmentNumber?: number; // Current installment (1, 2, 3...)
    installmentGroupId?: string; // ID to group related installments
    notes?: string;
    createdAt: string;
    updatedAt: string;
};

const COLLECTION_NAME = "transactions";

export const TransactionService = {
    getTransactions: async (tenantId: string): Promise<Transaction[]> => {
        try {
            // Note: Not using orderBy to avoid needing a composite index
            // Sorting is done client-side instead
            const q = query(
                collection(db, COLLECTION_NAME),
                where("tenantId", "==", tenantId)
            );
            const querySnapshot = await getDocs(q);
            const transactions = querySnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Transaction[];
            
            // Sort by date descending (client-side)
            return transactions.sort((a, b) => 
                new Date(b.date).getTime() - new Date(a.date).getTime()
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

    createTransaction: async (transaction: Omit<Transaction, "id">): Promise<Transaction> => {
        try {
            // Filter out undefined values - Firestore doesn't accept undefined
            const transactionData: Record<string, unknown> = {
                tenantId: transaction.tenantId,
                type: transaction.type,
                description: transaction.description,
                amount: transaction.amount,
                date: transaction.date,
                status: transaction.status,
                createdAt: transaction.createdAt,
                updatedAt: transaction.updatedAt,
            };

            // Only add optional fields if they have values
            if (transaction.dueDate) transactionData.dueDate = transaction.dueDate;
            if (transaction.clientId) transactionData.clientId = transaction.clientId;
            if (transaction.clientName) transactionData.clientName = transaction.clientName;
            if (transaction.proposalId) transactionData.proposalId = transaction.proposalId;
            if (transaction.category) transactionData.category = transaction.category;
            if (transaction.wallet) transactionData.wallet = transaction.wallet;
            if (transaction.isInstallment) transactionData.isInstallment = transaction.isInstallment;
            if (transaction.installmentCount) transactionData.installmentCount = transaction.installmentCount;
            if (transaction.installmentNumber) transactionData.installmentNumber = transaction.installmentNumber;
            if (transaction.installmentGroupId) transactionData.installmentGroupId = transaction.installmentGroupId;
            if (transaction.notes) transactionData.notes = transaction.notes;

            const docRef = await addDoc(collection(db, COLLECTION_NAME), transactionData);
            return { id: docRef.id, ...transactionData } as Transaction;
        } catch (error) {
            console.error("Error creating transaction:", error);
            throw error;
        }
    },

    updateTransaction: async (id: string, updates: Partial<Omit<Transaction, "id">>) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            
            // Filter out undefined values - Firestore doesn't accept undefined
            const updatedData: Record<string, unknown> = {
                updatedAt: new Date().toISOString(),
            };
            
            // Only add fields that have defined values
            if (updates.type !== undefined) updatedData.type = updates.type;
            if (updates.description !== undefined) updatedData.description = updates.description;
            if (updates.amount !== undefined) updatedData.amount = updates.amount;
            if (updates.date !== undefined) updatedData.date = updates.date;
            if (updates.status !== undefined) updatedData.status = updates.status;
            if (updates.dueDate !== undefined) updatedData.dueDate = updates.dueDate;
            if (updates.clientId !== undefined) updatedData.clientId = updates.clientId;
            if (updates.clientName !== undefined) updatedData.clientName = updates.clientName;
            if (updates.proposalId !== undefined) updatedData.proposalId = updates.proposalId;
            if (updates.category !== undefined) updatedData.category = updates.category;
            if (updates.wallet !== undefined) updatedData.wallet = updates.wallet;
            if (updates.isInstallment !== undefined) updatedData.isInstallment = updates.isInstallment;
            if (updates.installmentCount !== undefined) updatedData.installmentCount = updates.installmentCount;
            if (updates.installmentNumber !== undefined) updatedData.installmentNumber = updates.installmentNumber;
            if (updates.installmentGroupId !== undefined) updatedData.installmentGroupId = updates.installmentGroupId;
            if (updates.notes !== undefined) updatedData.notes = updates.notes;

            await updateDoc(docRef, updatedData);
            return { id, ...updatedData };
        } catch (error) {
            console.error("Error updating transaction:", error);
            throw error;
        }
    },

    deleteTransaction: async (id: string) => {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
            return true;
        } catch (error) {
            console.error("Error deleting transaction:", error);
            throw error;
        }
    },

    // Get summary for dashboard
    getSummary: async (tenantId: string): Promise<{
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
                if (t.type === 'income') {
                    if (t.status === 'paid') {
                        summary.totalIncome += t.amount;
                    } else {
                        summary.pendingIncome += t.amount;
                    }
                } else {
                    if (t.status === 'paid') {
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
