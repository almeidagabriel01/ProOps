"use client";

import { db } from "@/lib/firebase";
import { callApi } from "@/lib/api-client";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
} from "firebase/firestore";
import { Proposal, ProposalProduct } from "@/types/proposal";

const COLLECTION_NAME = "proposals";

export * from "@/types/proposal";

// Simple event bus for proposal updates
type ProposalChangeListener = () => void;
const listeners: Set<ProposalChangeListener> = new Set();

let savingPromise: Promise<void> | null = null;

const notifyListeners = () => {
  listeners.forEach((l) => l());
};

export const ProposalService = {
  // Saving synchronization
  notifySavingStarted: () => {
    let resolve: () => void;
    savingPromise = new Promise((r) => {
      resolve = r;
    });
    return () => {
      resolve();
      savingPromise = null;
    };
  },

  waitForSave: async () => {
    if (savingPromise) {
      await savingPromise;
    }
  },

  // Subscription method
  subscribe: (listener: ProposalChangeListener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  // ... existing methods

  getProposals: async (tenantId: string): Promise<Proposal[]> => {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("tenantId", "==", tenantId),
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate
            ? data.createdAt.toDate().toISOString()
            : data.createdAt,
          updatedAt: data.updatedAt?.toDate
            ? data.updatedAt.toDate().toISOString()
            : data.updatedAt,
        } as Proposal;
      });
    } catch (error) {
      console.error("Error fetching proposals:", error);
      throw error;
    }
  },

  getProposalById: async (id: string): Promise<Proposal | null> => {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate
            ? data.createdAt.toDate().toISOString()
            : data.createdAt,
        } as Proposal;
      }
      return null;
    } catch (error) {
      console.error("Error fetching proposal:", error);
      throw error;
    }
  },

  createProposal: async (data: Partial<Proposal>): Promise<Proposal> => {
    try {
      const result = await callApi<{ success: boolean; proposalId: string }>(
        "/v1/proposals",
        "POST",
        data,
      );

      notifyListeners(); // Notify list to refresh

      return {
        id: result.proposalId,
        ...data,
      } as Proposal;
    } catch (error) {
      console.error("Error creating proposal:", error);
      throw error;
    }
  },

  updateProposal: async (
    id: string,
    data: Partial<Proposal>,
  ): Promise<void> => {
    try {
      await callApi(`/v1/proposals/${id}`, "PUT", data);
      notifyListeners(); // Notify list to refresh
    } catch (error) {
      console.error("Error updating proposal:", error);
      throw error;
    }
  },

  deleteProposal: async (id: string): Promise<void> => {
    try {
      await callApi(`/v1/proposals/${id}`, "DELETE");
      notifyListeners(); // Notify list to refresh
    } catch (error) {
      console.error("Error deleting proposal:", error);
      throw error;
    }
  },

  isClientUsedInProposal: async (
    clientId: string,
    tenantId: string,
  ): Promise<boolean> => {
    // Validate both parameters are provided
    if (!clientId || !tenantId) {
      console.warn(
        "isClientUsedInProposal called without clientId or tenantId",
      );
      return false;
    }

    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("tenantId", "==", tenantId),
        where("clientId", "==", clientId),
      );
      const snap = await getDocs(q);
      return !snap.empty;
    } catch (error) {
      console.error("Error checking client usage:", error);
      // Block deletion to be safe if we can't verify
      return true;
    }
  },

  isProductUsedInProposal: async (
    productId: string,
    tenantId?: string,
  ): Promise<boolean> => {
    // Basic validation
    if (!productId || !tenantId) {
      console.warn(
        "isProductUsedInProposal called without productId or tenantId",
      );
      return false;
    }

    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("tenantId", "==", tenantId),
      );

      const querySnapshot = await getDocs(q);

      // Client-side filtering because Firestore can't query inside array of objects easily
      // without specific structure or third-party search (like Algolia)
      for (const doc of querySnapshot.docs) {
        const data = doc.data();
        const products = data.products || [];
        // Check if any product in the array matches exactly the productId
        if (
          Array.isArray(products) &&
          products.some((p: ProposalProduct) => p.productId === productId)
        ) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error("Error checking product usage:", error);
      // In case of error, better NOT to block deletion unless we are sure, or block to be safe?
      // Blocking to be safe is better to prevent data integrity issues.
      return true;
    }
  },
};
