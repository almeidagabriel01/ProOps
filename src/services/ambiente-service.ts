"use client";

import { db, functions } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { Ambiente } from "@/types/automation";

const COLLECTION_NAME = "ambientes";

export const AmbienteService = {
  getAmbientes: async (tenantId: string): Promise<Ambiente[]> => {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("tenantId", "==", tenantId)
      );
      const querySnapshot = await getDocs(q);
      const ambientes = querySnapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as Ambiente
      );
      // Ordenar no cliente para evitar necessidade de índice composto
      return ambientes.sort((a, b) => (a.order || 0) - (b.order || 0));
    } catch (error) {
      console.error("Error fetching ambientes:", error);
      throw error;
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

  createAmbiente: async (data: Omit<Ambiente, "id">): Promise<Ambiente> => {
    try {
      const createFunc = httpsCallable<
        any,
        { success: boolean; ambienteId: string }
      >(functions, "createAmbiente");

      // Ensure order is a valid number (default to 0 if NaN or undefined)
      const safeOrder =
        typeof data.order === "number" && !isNaN(data.order) ? data.order : 0;

      const result = await createFunc({
        name: data.name,
        icon: data.icon,
        order: safeOrder,
      });

      return { id: result.data.ambienteId, ...data, order: safeOrder };
    } catch (error) {
      console.error("Error creating ambiente:", error);
      throw error;
    }
  },

  updateAmbiente: async (
    id: string,
    data: Partial<Omit<Ambiente, "id">>
  ): Promise<void> => {
    try {
      const updateFunc = httpsCallable(functions, "updateAmbiente");

      await updateFunc({ ambienteId: id, ...data });
    } catch (error) {
      console.error("Error updating ambiente:", error);
      throw error;
    }
  },

  deleteAmbiente: async (id: string): Promise<void> => {
    try {
      const deleteFunc = httpsCallable(functions, "deleteAmbiente");

      await deleteFunc({ ambienteId: id });
    } catch (error) {
      console.error("Error deleting ambiente:", error);
      throw error;
    }
  },

  // Obter próximo número de ordem
  getNextOrder: async (tenantId: string): Promise<number> => {
    try {
      const ambientes = await AmbienteService.getAmbientes(tenantId);
      if (ambientes.length === 0) return 0;
      // Filter out any NaN or undefined values, default to 0
      const orders = ambientes.map((a) => {
        const orderValue =
          typeof a.order === "number" && !isNaN(a.order) ? a.order : 0;
        return orderValue;
      });
      return Math.max(...orders) + 1;
    } catch {
      return 0;
    }
  },
};
