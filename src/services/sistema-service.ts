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
import {
  Sistema,
  SistemaProduct,
  SistemaAmbienteTemplate,
} from "@/types/automation";

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

  // New field: detailed configuration
  // If not present, we migrate in-memory from the ID list
  // New field: detailed configuration
  // If not present, we migrate in-memory from the ID list
  const rawAmbientes =
    (data.ambientes as Array<{ ambienteId?: string; products?: unknown[] }>) ||
    [];
  let ambientes: SistemaAmbienteTemplate[] = rawAmbientes
    .map((a) => ({
      ambienteId: a.ambienteId || "",
      products: Array.isArray(a.products)
        ? (a.products as SistemaAmbienteTemplate["products"])
        : [],
      description: (a as any).description,
    }))
    .filter((a) => a.ambienteId); // Filter out invalid entries

  if (ambientes.length === 0 && availableAmbienteIds.length > 0) {
    ambientes = availableAmbienteIds.map((aid) => ({
      ambienteId: aid,
      products: [], // Default to empty if migrating from ID list
    }));
  }

  return {
    id,
    tenantId: data.tenantId as string,
    name: data.name as string,
    description: (data.description as string) || "",
    icon: data.icon as string | undefined,
    ambientes,
    createdAt: data.createdAt as string,
    updatedAt: data.updatedAt as string,

    // Deprecated fields kept for backward compatibility and migration
    availableAmbienteIds,
    defaultProducts: (data.defaultProducts as SistemaProduct[]) || [],
    ambienteIds: availableAmbienteIds,
  };
}

export const SistemaService = {
  getSistemas: async (tenantId: string): Promise<Sistema[]> => {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("tenantId", "==", tenantId),
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) =>
        normalizeSistema(doc.id, doc.data()),
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
    ambienteId: string,
  ): Promise<Sistema[]> => {
    try {
      const sistemas = await SistemaService.getSistemas(tenantId);
      return sistemas.filter(
        (s) =>
          // Check new structure
          s.ambientes.some((a) => a.ambienteId === ambienteId) ||
          // Check legacy
          s.availableAmbienteIds?.includes(ambienteId),
      );
    } catch (error) {
      console.error("Error fetching sistemas by ambiente:", error);
      throw error;
    }
  },

  /**
   * Get ambientes available for a specific sistema
   */
  getAmbientesBySistema: async (sistemaId: string): Promise<string[]> => {
    try {
      const sistema = await SistemaService.getSistemaById(sistemaId);
      if (!sistema) return [];
      return sistema.ambientes.map((a) => a.ambienteId);
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
      // Sync legacy fields
      const legacyIds = data.ambientes.map((a) => a.ambienteId);

      const payload = {
        name: data.name,
        description: data.description,
        icon: data.icon,
        ambientes: data.ambientes,
        tenantId: data.tenantId,
        // Legacy fields for backward compat
        availableAmbienteIds: legacyIds,
        ambienteIds: legacyIds,
        defaultProducts: data.defaultProducts || [],
      };

      const result = await callApi<{
        success: boolean;
        id: string;
        message: string;
      }>("/v1/aux/sistemas", "POST", payload);

      return {
        id: result.id,
        ...data,
        availableAmbienteIds: legacyIds,
      };
    } catch (error) {
      console.error("Error creating sistema:", error);
      throw error;
    }
  },

  updateSistema: async (
    id: string,
    data: Partial<Omit<Sistema, "id">>,
  ): Promise<void> => {
    try {
      // Normalize field names before sending
      const payload: Record<string, unknown> = { ...data };

      // If updating configured environments, sync legacy fields
      if (data.ambientes) {
        const legacyIds = data.ambientes.map((a) => a.ambienteId);
        payload.availableAmbienteIds = legacyIds;
        payload.ambienteIds = legacyIds;
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
