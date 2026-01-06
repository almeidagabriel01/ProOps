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
import { Sistema } from "@/types/automation";

const COLLECTION_NAME = "sistemas";

export const SistemaService = {
  getSistemas: async (tenantId: string): Promise<Sistema[]> => {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("tenantId", "==", tenantId)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as Sistema
      );
    } catch (error) {
      console.error("Error fetching sistemas:", error);
      throw error;
    }
  },

  getSistemasByAmbiente: async (
    tenantId: string,
    ambienteId: string
  ): Promise<Sistema[]> => {
    try {
      const sistemas = await SistemaService.getSistemas(tenantId);
      return sistemas.filter((s) => s.ambienteIds.includes(ambienteId));
    } catch (error) {
      console.error("Error fetching sistemas by ambiente:", error);
      throw error;
    }
  },

  getSistemaById: async (id: string): Promise<Sistema | null> => {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Sistema;
      }
      return null;
    } catch (error) {
      console.error("Error fetching sistema:", error);
      throw error;
    }
  },

  createSistema: async (data: Omit<Sistema, "id">): Promise<Sistema> => {
    try {
      const sanitizedProducts = (data.defaultProducts || []).map((p) => ({
        ...p,
        quantity:
          typeof p.quantity === "number" && !isNaN(p.quantity)
            ? Math.max(1, p.quantity)
            : 1,
      }));

      const payload = {
        name: data.name,
        description: data.description,
        icon: data.icon,
        ambienteIds: data.ambienteIds || [],
        defaultProducts: sanitizedProducts,
      };

      const result = await callApi<{ success: boolean; id: string; message: string }>(
        "/v1/aux/sistemas", 
        "POST", 
        payload
      );

      return {
        id: result.id,
        ...data,
        defaultProducts: sanitizedProducts,
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
      await callApi(`/v1/aux/sistemas/${id}`, "PUT", data);
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
