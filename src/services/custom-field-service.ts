"use client";

import { db } from "@/lib/firebase";
import { callApi } from "@/lib/api-client";
import { collection, getDocs, query, where } from "firebase/firestore";
import { CustomFieldType } from "@/types";

export type CustomField = {
  id: string;
  tenantId: string;
  label: string;
  type: string; // text, number, date, etc.
  params?: Record<string, unknown>;
  createdAt?: string;
};

const COLLECTION_NAME = "custom_fields";

export const CustomFieldService = {
  getFields: async (tenantId: string): Promise<CustomField[]> => {
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
            createdAt:
              doc.data().createdAt?.toDate?.()?.toISOString() ||
              doc.data().createdAt,
          }) as CustomField
      );
    } catch (error) {
      console.error("Error fetching fields:", error);
      return [];
    }
  },

  createField: async (
    tenantId: string,
    data: Omit<CustomField, "id" | "tenantId">
  ): Promise<CustomField> => {
    const result = await callApi<{ success: boolean; id: string }>(
      "/v1/aux/custom-fields",
      "POST",
      { tenantId, ...data }
    );
    return {
      id: result.id,
      tenantId,
      ...data,
    };
  },

  updateField: async (
    id: string,
    data: Partial<CustomField>
  ): Promise<void> => {
    await callApi(`/v1/aux/custom-fields/${id}`, "PUT", data);
  },

  deleteField: async (id: string): Promise<void> => {
    await callApi(`/v1/aux/custom-fields/${id}`, "DELETE");
  },

  // Custom Field Types (Categorias/Tipos de Campos Personalizados com itens)
  getCustomFieldTypes: async (tenantId: string): Promise<CustomFieldType[]> => {
    try {
      const q = query(
        collection(db, "custom_field_types"),
        where("tenantId", "==", tenantId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as CustomFieldType
      );
    } catch (error) {
      console.error("Error fetching field types:", error);
      return [];
    }
  },

  getCustomFieldTypeById: async (
    id: string
  ): Promise<CustomFieldType | null> => {
    try {
      // Direct read via API or Firestore
      // For build fix, assuming simple fetch or mock if API not ready,
      // but usage implies we need actual data.
      // Let's assume we can fetch it like other docs.
      // Actually, let's use the list method or simple getDoc if we had db import
      // We do have db import.
      const { doc, getDoc } = await import("firebase/firestore"); // Lazy load or assume import available
      // Re-using top level imports
      const docRef = doc(db, "custom_field_types", id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as CustomFieldType;
      }
      return null;
    } catch (e) {
      console.error(e);
      return null;
    }
  },

  createCustomFieldType: async (
    data: Partial<CustomFieldType>
  ): Promise<CustomFieldType> => {
    const result = await callApi<{ success: boolean; id: string }>(
      "/v1/aux/custom-field-types",
      "POST",
      data
    );
    return { id: result.id, ...data } as CustomFieldType;
  },

  updateCustomFieldType: async (
    id: string,
    data: Partial<CustomFieldType>
  ): Promise<void> => {
    await callApi(`/v1/aux/custom-field-types/${id}`, "PUT", data);
  },

  deleteCustomFieldType: async (id: string): Promise<void> => {
    await callApi(`/v1/aux/custom-field-types/${id}`, "DELETE");
  },
};
