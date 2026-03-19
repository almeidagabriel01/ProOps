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
import { AmbienteProduct } from "@/types/automation";
import { normalizeItemQuantity } from "@/lib/quantity-utils";

/**
 * Produto associado a um Ambiente
 */
export type { AmbienteProduct };

/**
 * Ambiente - contém produtos padrão como template
 */
export interface Ambiente {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  icon?: string;
  order?: number;
  // Template de produtos padrão para este ambiente
  defaultProducts: AmbienteProduct[];
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
            // Ensure defaultProducts is always an array
            defaultProducts: doc.data().defaultProducts || [],
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
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          defaultProducts: data.defaultProducts || [],
        } as Ambiente;
      }
      return null;
    } catch (error) {
      console.error("Error fetching ambiente:", error);
      throw error;
    }
  },

  getAmbientesByIds: async (ids: string[]): Promise<Ambiente[]> => {
    if (ids.length === 0) return [];
    try {
      // Fetch each ambiente by ID
      const promises = ids.map((id) => AmbienteService.getAmbienteById(id));
      const results = await Promise.all(promises);
      return results.filter((a): a is Ambiente => a !== null);
    } catch (error) {
      console.error("Error fetching ambientes by ids:", error);
      throw error;
    }
  },

  createAmbiente: async (data: Partial<Ambiente>): Promise<Ambiente> => {
    // Sanitize products before sending
    const sanitizedProducts = (data.defaultProducts || []).map((p) => ({
      ...p,
      quantity: normalizeItemQuantity(
        typeof p.quantity === "number" ? p.quantity : 0,
        (p.itemType || "product") !== "service",
      ),
    }));

    const payload = {
      ...data,
      defaultProducts: sanitizedProducts,
    };

    const result = await callApi<{ success: boolean; id: string }>(
      "/v1/aux/ambientes",
      "POST",
      payload,
    );
    return {
      id: result.id,
      tenantId: data.tenantId || "",
      name: data.name || "",
      defaultProducts: sanitizedProducts,
      ...data,
    } as Ambiente;
  },

  updateAmbiente: async (
    id: string,
    data: Partial<Ambiente>,
  ): Promise<void> => {
    // Sanitize products if included
    const payload = { ...data };
    if (data.defaultProducts) {
      payload.defaultProducts = data.defaultProducts.map((p) => ({
        ...p,
        quantity: normalizeItemQuantity(
          typeof p.quantity === "number" ? p.quantity : 0,
          (p.itemType || "product") !== "service",
        ),
      }));
    }
    await callApi(`/v1/aux/ambientes/${id}`, "PUT", payload);
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
