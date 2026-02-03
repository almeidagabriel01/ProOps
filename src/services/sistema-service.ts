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
import { Sistema, SistemaProduct } from "@/types/automation";

const COLLECTION_NAME = "sistemas";

/**
 * Normaliza um Sistema para garantir compatibilidade entre formato novo e legado
 */
function normalizeSistema(id: string, data: Record<string, unknown>): Sistema {
  // Handle migration: availableAmbienteIds (new) vs ambienteIds (legacy)
  const availableAmbienteIds = 
    (data.availableAmbienteIds as string[]) || 
    (data.ambienteIds as string[]) || 
    [];

  return {
    id,
    tenantId: data.tenantId as string,
    name: data.name as string,
    description: (data.description as string) || "",
    icon: data.icon as string | undefined,
    availableAmbienteIds,
    createdAt: data.createdAt as string,
    updatedAt: data.updatedAt as string,
    // Deprecated fields kept for backward compatibility
    defaultProducts: (data.defaultProducts as SistemaProduct[]) || [],
    ambienteIds: availableAmbienteIds,
  };
}

export const SistemaService = {
  getSistemas: async (tenantId: string): Promise<Sistema[]> => {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("tenantId", "==", tenantId)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) =>
        normalizeSistema(doc.id, doc.data())
      );
    } catch (error) {
      console.error("Error fetching sistemas:", error);
      throw error;
    }
  },

  /**
   * Get sistemas that have a specific ambiente in their available list
   */
  getSistemasByAmbiente: async (
    tenantId: string,
    ambienteId: string
  ): Promise<Sistema[]> => {
    try {
      const sistemas = await SistemaService.getSistemas(tenantId);
      return sistemas.filter((s) => 
        s.availableAmbienteIds.includes(ambienteId) ||
        // Fallback for legacy data
        s.ambienteIds?.includes(ambienteId)
      );
    } catch (error) {
      console.error("Error fetching sistemas by ambiente:", error);
      throw error;
    }
  },

  /**
   * Get ambientes available for a specific sistema
   */
  getAmbientesBySistema: async (
    sistemaId: string
  ): Promise<string[]> => {
    try {
      const sistema = await SistemaService.getSistemaById(sistemaId);
      if (!sistema) return [];
      return sistema.availableAmbienteIds || sistema.ambienteIds || [];
    } catch (error) {
      console.error("Error fetching ambientes by sistema:", error);
      throw error;
    }
  },

  getSistemaById: async (id: string): Promise<Sistema | null> => {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return normalizeSistema(docSnap.id, docSnap.data());
      }
      return null;
    } catch (error) {
      console.error("Error fetching sistema:", error);
      throw error;
    }
  },

  createSistema: async (data: Omit<Sistema, "id">): Promise<Sistema> => {
    try {
      // For new sistemas, use availableAmbienteIds
      const payload = {
        name: data.name,
        description: data.description,
        icon: data.icon,
        availableAmbienteIds: data.availableAmbienteIds || data.ambienteIds || [],
        tenantId: data.tenantId,
        // Legacy: still send defaultProducts if present (for backward compat)
        ...(data.defaultProducts?.length ? { defaultProducts: data.defaultProducts } : {}),
      };

      const result = await callApi<{ success: boolean; id: string; message: string }>(
        "/v1/aux/sistemas", 
        "POST", 
        payload
      );

      return {
        id: result.id,
        ...data,
        availableAmbienteIds: payload.availableAmbienteIds,
      };
    } catch (error) {
      console.error("Error creating sistema:", error);
      throw error;
    }
  },

  updateSistema: async (
    id: string,
    data: Partial<Omit<Sistema, "id">>
  ): Promise<void> => {
    try {
      // Normalize field names before sending
      const payload = { ...data };
      if (data.availableAmbienteIds) {
        // Also set ambienteIds for backward compat
        payload.ambienteIds = data.availableAmbienteIds;
      }
      await callApi(`/v1/aux/sistemas/${id}`, "PUT", payload);
    } catch (error) {
      console.error("Error updating sistema:", error);
      throw error;
    }
  },

  deleteSistema: async (id: string): Promise<void> => {
    try {
      await callApi(`/v1/aux/sistemas/${id}`, "DELETE");
    } catch (error) {
      console.error("Error deleting sistema:", error);
      throw error;
    }
  },
};
