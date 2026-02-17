"use client";

import { db } from "@/lib/firebase";
import { callApi } from "@/lib/api-client";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import { ConnectedAccount } from "@/types";

const COLLECTION_NAME = "connected_accounts";

export interface CreateConnectedAccountInput {
  provider: ConnectedAccount["provider"];
  providerItemId: string;
  accessToken?: string;
  bankName?: string;
  bankImageUrl?: string;
  targetTenantId?: string; // Optional, for admin usage
}

export interface UpdateConnectedAccountInput {
  status?: ConnectedAccount["status"];
  accessToken?: string;
  lastSyncAt?: string;
  providerItemId?: string; // In case it changes (re-auth)
}

export const ConnectedAccountService = {
  /**
   * Get all connected accounts for a tenant
   */
  getConnectedAccounts: async (
    tenantId: string,
  ): Promise<ConnectedAccount[]> => {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("tenantId", "==", tenantId),
      );
      const querySnapshot = await getDocs(q);
      const accounts = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt:
          doc.data().createdAt?.toDate?.()?.toISOString() ||
          doc.data().createdAt,
        updatedAt:
          doc.data().updatedAt?.toDate?.()?.toISOString() ||
          doc.data().updatedAt,
        lastSyncAt:
          doc.data().lastSyncAt?.toDate?.()?.toISOString() ||
          doc.data().lastSyncAt,
      })) as ConnectedAccount[];

      // Sort by bank name
      return accounts.sort((a, b) =>
        (a.bankName || "").localeCompare(b.bankName || ""),
      );
    } catch (error) {
      console.error("Error fetching connected accounts:", error);
      throw error;
    }
  },

  /**
   * Get a single connected account by ID
   */
  getConnectedAccountById: async (
    id: string,
  ): Promise<ConnectedAccount | null> => {
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
          lastSyncAt:
            data.lastSyncAt?.toDate?.()?.toISOString() || data.lastSyncAt,
        } as ConnectedAccount;
      }
      return null;
    } catch (error) {
      console.error("Error fetching connected account:", error);
      throw error;
    }
  },

  /**
   * Create a new connected account via Cloud Function
   * (Securely stores tokens server-side)
   */
  createConnectedAccount: async (
    data: CreateConnectedAccountInput,
  ): Promise<{ id: string }> => {
    try {
      const result = await callApi<{
        success: boolean;
        id: string;
      }>("v1/connected-accounts", "POST", data);
      return { id: result.id };
    } catch (error) {
      console.error("Error creating connected account:", error);
      throw error;
    }
  },

  /**
   * Update a connected account via Cloud Function
   */
  updateConnectedAccount: async (
    id: string,
    data: UpdateConnectedAccountInput,
  ): Promise<void> => {
    try {
      await callApi(`v1/connected-accounts/${id}`, "PUT", data);
    } catch (error) {
      console.error("Error updating connected account:", error);
      throw error;
    }
  },

  /**
   * Disconnect/Remove a connected account
   */
  removeConnectedAccount: async (id: string): Promise<void> => {
    try {
      await callApi(`v1/connected-accounts/${id}`, "DELETE");
    } catch (error) {
      console.error("Error removing connected account:", error);
      throw error;
    }
  },

  /**
   * Sync transactions from provider manually
   */
  syncAccount: async (id: string): Promise<{ importedCount: number }> => {
    try {
      const result = await callApi<{
        success: boolean;
        importedCount: number;
        message: string;
      }>(`v1/connected-accounts/${id}/sync`, "POST");
      return { importedCount: result.importedCount };
    } catch (error) {
      console.error("Error syncing account:", error);
      throw error;
    }
  },
  /**
   * Get a Pluggy Connect Token from the backend
   * Used to initialize the Pluggy Connect widget
   */
  getConnectToken: async (itemId?: string): Promise<string> => {
    try {
      const result = await callApi<{ accessToken: string }>(
        "v1/pluggy/connect-token",
        "POST",
        itemId ? { itemId } : {},
      );
      return result.accessToken;
    } catch (error) {
      console.error("Error getting connect token:", error);
      throw error;
    }
  },
};
