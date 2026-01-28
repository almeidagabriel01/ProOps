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

// Shared Type Definition
export interface Ambiente {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  icon?: string;
  order?: number;
  createdAt?: string;
}

const COLLECTION_NAME = "ambientes";

export const AmbienteService = {
  getAmbientes: async (tenantId: string): Promise<Ambiente[]> => {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("tenantId", "==", tenantId),
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
            createdAt:
              doc.data().createdAt?.toDate?.()?.toISOString() ||
              doc.data().createdAt,
          }) as Ambiente,
      );
    } catch (error) {
      console.error("Error fetching ambientes:", error);
      throw error; // Let the caller handle
    }
  },

  getAmbienteById: async (id: string): Promise<Ambiente | null> => {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Ambiente;
      }
      return null;
    } catch (error) {
      console.error("Error fetching ambiente:", error);
      throw error;
    }
  },

  createAmbiente: async (data: Partial<Ambiente>): Promise<Ambiente> => {
    const result = await callApi<{ success: boolean; id: string }>(
      "/v1/aux/ambientes",
      "POST",
      data,
    );
    return {
      id: result.id,
      tenantId: data.tenantId || "",
      name: data.name || "",
      ...data,
    } as Ambiente;
  },

  updateAmbiente: async (
    id: string,
    data: Partial<Ambiente>,
  ): Promise<void> => {
    await callApi(`/v1/aux/ambientes/${id}`, "PUT", data);
  },

  deleteAmbiente: async (id: string): Promise<void> => {
    await callApi(`/v1/aux/ambientes/${id}`, "DELETE");
  },

  getNextOrder: async (tenantId: string): Promise<number> => {
    // Logic to find max order + 1
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("tenantId", "==", tenantId),
      );
      const snap = await getDocs(q);
      if (snap.empty) return 1;
      const maxOrder = Math.max(...snap.docs.map((d) => d.data().order || 0));
      return maxOrder + 1;
    } catch {
      return 1;
    }
  },
};
