"use client";

import { db } from "@/lib/firebase";
import { callApi } from "@/lib/api-client";
import { collection, getDocs, query, where } from "firebase/firestore";

export type Option = {
  id: string;
  tenantId: string;
  type: string;
  label: string;
  createdAt?: string;
};

const COLLECTION_NAME = "options";

export const OptionService = {
  getOptions: async (tenantId: string, type: string): Promise<Option[]> => {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("tenantId", "==", tenantId),
        where("type", "==", type) // Note: ensure field name matches API (was fieldType in old function?) API uses standard fields
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
          }) as Option
      );
    } catch (error) {
      console.error("Error fetching options:", error);
      return [];
    }
  },

  createOption: async (
    tenantId: string,
    type: string,
    label: string
  ): Promise<Option> => {
      const result = await callApi<{ success: boolean; id: string }>(
        "/v1/aux/options",
        "POST",
        { tenantId, type, label }
      );
      return {
          id: result.id,
          tenantId,
          type,
          label,
          createdAt: new Date().toISOString()
      };
  },

  updateOption: async (id: string, label: string): Promise<void> => {
      await callApi(`/v1/aux/options/${id}`, "PUT", { label });
  },

  deleteOption: async (id: string): Promise<void> => {
      await callApi(`/v1/aux/options/${id}`, "DELETE");
  },
};
