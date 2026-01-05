"use client";

import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  orderBy,
} from "firebase/firestore";
import { Wallet, WalletTransaction } from "@/types";

// ============================================
// TYPES
// ============================================

export interface CreateWalletInput {
  name: string;
  type: Wallet["type"];
  initialBalance?: number;
  color: string;
  icon?: string;
  description?: string;
  isDefault?: boolean;
}

export interface UpdateWalletInput {
  name?: string;
  type?: Wallet["type"];
  color?: string;
  icon?: string;
  description?: string;
  isDefault?: boolean;
  status?: Wallet["status"];
}

export interface TransferInput {
  fromWalletId: string;
  toWalletId: string;
  amount: number;
  description?: string;
}

export interface AdjustBalanceInput {
  amount: number; // Positive = add, Negative = remove
  description: string;
}

export interface WalletSummary {
  totalBalance: number;
  walletCount: number;
  activeWallets: number;
}

// ============================================
// SERVICE
// ============================================

const COLLECTION_NAME = "wallets";
const TRANSACTIONS_COLLECTION = "wallet_transactions";

export const WalletService = {
  /**
   * Get all wallets for a tenant
   */
  getWallets: async (tenantId: string): Promise<Wallet[]> => {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("tenantId", "==", tenantId)
      );
      const querySnapshot = await getDocs(q);
      const wallets = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt:
          doc.data().createdAt?.toDate?.()?.toISOString() ||
          doc.data().createdAt,
        updatedAt:
          doc.data().updatedAt?.toDate?.()?.toISOString() ||
          doc.data().updatedAt,
      })) as Wallet[];

      // Sort by name
      return wallets.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error("Error fetching wallets:", error);
      throw error;
    }
  },

  /**
   * Get a single wallet by ID
   */
  getWalletById: async (id: string): Promise<Wallet | null> => {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt:
            data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt:
            data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        } as Wallet;
      }
      return null;
    } catch (error) {
      console.error("Error fetching wallet:", error);
      throw error;
    }
  },

  /**
   * Create a new wallet via Cloud Function
   */
  createWallet: async (
    data: CreateWalletInput
  ): Promise<{ walletId: string }> => {
    try {
      const { getFunctions, httpsCallable } =
        await import("firebase/functions");
      const functions = getFunctions(undefined, "southamerica-east1");
      const createFunc = httpsCallable<
        CreateWalletInput,
        { success: boolean; walletId: string; message: string }
      >(functions, "createWallet");

      const result = await createFunc(data);
      return { walletId: result.data.walletId };
    } catch (error) {
      console.error("Error creating wallet:", error);
      throw error;
    }
  },

  /**
   * Update a wallet via Cloud Function
   */
  updateWallet: async (
    walletId: string,
    data: UpdateWalletInput
  ): Promise<void> => {
    try {
      const { getFunctions, httpsCallable } =
        await import("firebase/functions");
      const functions = getFunctions(undefined, "southamerica-east1");
      const updateFunc = httpsCallable<
        { walletId: string } & UpdateWalletInput,
        { success: boolean; message: string }
      >(functions, "updateWallet");

      await updateFunc({ walletId, ...data });
    } catch (error) {
      console.error("Error updating wallet:", error);
      throw error;
    }
  },

  /**
   * Delete a wallet via Cloud Function
   */
  deleteWallet: async (walletId: string, force = false): Promise<void> => {
    try {
      const { getFunctions, httpsCallable } =
        await import("firebase/functions");
      const functions = getFunctions(undefined, "southamerica-east1");
      const deleteFunc = httpsCallable<
        { walletId: string; force: boolean },
        { success: boolean; message: string }
      >(functions, "deleteWallet");

      await deleteFunc({ walletId, force });
    } catch (error) {
      console.error("Error deleting wallet:", error);
      throw error;
    }
  },

  /**
   * Transfer balance between wallets via Cloud Function
   */
  transferBalance: async (data: TransferInput): Promise<void> => {
    try {
      const { getFunctions, httpsCallable } =
        await import("firebase/functions");
      const functions = getFunctions(undefined, "southamerica-east1");
      const transferFunc = httpsCallable<
        TransferInput,
        { success: boolean; message: string }
      >(functions, "transferBetweenWallets");

      await transferFunc(data);
    } catch (error) {
      console.error("Error transferring balance:", error);
      throw error;
    }
  },

  /**
   * Adjust wallet balance (add/remove) via Cloud Function
   */
  adjustBalance: async (
    walletId: string,
    data: AdjustBalanceInput
  ): Promise<{ newBalance: number }> => {
    try {
      const { getFunctions, httpsCallable } =
        await import("firebase/functions");
      const functions = getFunctions(undefined, "southamerica-east1");
      const adjustFunc = httpsCallable<
        { walletId: string } & AdjustBalanceInput,
        { success: boolean; newBalance: number; message: string }
      >(functions, "adjustWalletBalance");

      const result = await adjustFunc({ walletId, ...data });
      return { newBalance: result.data.newBalance };
    } catch (error) {
      console.error("Error adjusting balance:", error);
      throw error;
    }
  },

  /**
   * Get wallet transaction history
   */
  getWalletTransactions: async (
    walletId: string,
    tenantId: string
  ): Promise<WalletTransaction[]> => {
    try {
      const q = query(
        collection(db, TRANSACTIONS_COLLECTION),
        where("tenantId", "==", tenantId),
        where("walletId", "==", walletId)
      );
      const querySnapshot = await getDocs(q);
      const transactions = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt:
          doc.data().createdAt?.toDate?.()?.toISOString() ||
          doc.data().createdAt,
      })) as WalletTransaction[];

      // Sort by date descending
      return transactions.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (error) {
      console.error("Error fetching wallet transactions:", error);
      throw error;
    }
  },

  /**
   * Get summary of all wallets for a tenant
   */
  getSummary: async (tenantId: string): Promise<WalletSummary> => {
    try {
      const wallets = await WalletService.getWallets(tenantId);

      const summary: WalletSummary = {
        totalBalance: 0,
        walletCount: wallets.length,
        activeWallets: 0,
      };

      wallets.forEach((wallet) => {
        if (wallet.status === "active") {
          summary.totalBalance += wallet.balance;
          summary.activeWallets++;
        }
      });

      return summary;
    } catch (error) {
      console.error("Error getting wallet summary:", error);
      throw error;
    }
  },

  /**
   * Get the default wallet for a tenant
   */
  getDefaultWallet: async (tenantId: string): Promise<Wallet | null> => {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("tenantId", "==", tenantId),
        where("isDefault", "==", true)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
      } as Wallet;
    } catch (error) {
      console.error("Error fetching default wallet:", error);
      throw error;
    }
  },
};
