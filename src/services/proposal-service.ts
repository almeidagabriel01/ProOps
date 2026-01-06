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
import { Proposal } from "@/types/proposal";

const COLLECTION_NAME = "proposals";

export * from "@/types/proposal";

export const ProposalService = {
  // ... existing methods

  getProposals: async (tenantId: string): Promise<Proposal[]> => {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("tenantId", "==", tenantId)
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
        data
      );

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
    data: Partial<Proposal>
  ): Promise<void> => {
    try {
      await callApi(`/v1/proposals/${id}`, "PUT", data);
    } catch (error) {
      console.error("Error updating proposal:", error);
      throw error;
    }
  },

  deleteProposal: async (id: string): Promise<void> => {
    try {
      await callApi(`/v1/proposals/${id}`, "DELETE");
    } catch (error) {
      console.error("Error deleting proposal:", error);
      throw error;
    }
  },

  isClientUsedInProposal: async (clientId: string): Promise<boolean> => {
    // Placeholder: assuming we check strictly or leniently
    // Ideally this should be a backend check or a specific query
    const q = query(
      collection(db, COLLECTION_NAME),
      where("clientId", "==", clientId)
      // limit(1) would be good but standard SDK query
    );
    const snap = await getDocs(q);
    return !snap.empty;
  },

  isProductUsedInProposal: async (productId: string, tenantId?: string): Promise<boolean> => {
    // Basic validation
    if (!productId || !tenantId) {
      console.warn("isProductUsedInProposal called without productId or tenantId");
      return false; 
    }

    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("tenantId", "==", tenantId)
      );
      
      const querySnapshot = await getDocs(q);
      
      // Client-side filtering because Firestore can't query inside array of objects easily
      // without specific structure or third-party search (like Algolia)
      for (const doc of querySnapshot.docs) {
        const data = doc.data();
        const products = data.products || [];
        // Check if any product in the array matches exactly the productId
        if (Array.isArray(products) && products.some((p: any) => p.productId === productId)) {
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
