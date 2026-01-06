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
import { CustomFieldType } from "@/types";

const COLLECTION_NAME = "custom_fields";

export const CustomFieldService = {
  getCustomFieldTypes: async (tenantId: string): Promise<CustomFieldType[]> => {
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
          }) as CustomFieldType
      );
    } catch (error) {
      console.error("Error fetching custom field types:", error);
      throw error;
    }
  },

  getCustomFieldTypeById: async (
    id: string
  ): Promise<CustomFieldType | null> => {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as CustomFieldType;
      } else {
        return null;
      }
    } catch (error) {
      console.error("Error fetching custom field type:", error);
      throw error;
    }
  },

  createCustomFieldType: async (
    data: Omit<CustomFieldType, "id">
  ): Promise<CustomFieldType> => {
    try {
      const createFunc = httpsCallable<
        any,
        { success: boolean; customFieldId: string }
      >(functions, "createCustomField");

      const result = await createFunc({
        name: data.name,
        description: data.description,
        parentTypeId: data.parentTypeId,
        items: data.items,
      });

      return { id: result.data.customFieldId, ...data };
    } catch (error) {
      console.error("Error creating custom field type:", error);
      throw error;
    }
  },

  updateCustomFieldType: async (
    id: string,
    data: Partial<Omit<CustomFieldType, "id">>
  ): Promise<void> => {
    try {
      const updateFunc = httpsCallable(functions, "updateCustomField");

      await updateFunc({ customFieldId: id, ...data });
    } catch (error) {
      console.error("Error updating custom field type:", error);
      throw error;
    }
  },

  deleteCustomFieldType: async (id: string): Promise<void> => {
    try {
      const deleteFunc = httpsCallable(functions, "deleteCustomField");

      await deleteFunc({ customFieldId: id });
    } catch (error) {
      console.error("Error deleting custom field type:", error);
      throw error;
    }
  },
};
