"use client";

import { db } from "@/lib/firebase";
import { collection, doc, getDocs, query, where } from "firebase/firestore";

export type Option = {
    id: string;
    tenantId: string;
    type: string; // e.g. "product_categories", "product_manufacturers"
    label: string;
    createdAt?: string;
}

const COLLECTION_NAME = "custom_options";

export const OptionService = {
    getOptions: async (tenantId: string, type: string): Promise<Option[]> => {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where("tenantId", "==", tenantId),
                where("type", "==", type)
            );
            
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Option));
        } catch (error) {
            console.error("Error fetching options:", error);
            return [];
        }
    },

    createOption: async (tenantId: string, type: string, label: string): Promise<Option> => {
        try {
            const { getFunctions, httpsCallable } = await import("firebase/functions");
            const functions = getFunctions(undefined, 'southamerica-east1');
            const createFunc = httpsCallable<any, { success: boolean; optionId: string }>(functions, 'createOption');
            
            const result = await createFunc({
                fieldType: type,
                label,
            });
            
            return { 
                id: result.data.optionId, 
                tenantId,
                type,
                label,
                createdAt: new Date().toISOString()
            };
        } catch (error) {
            console.error("Error creating option:", error);
            throw error;
        }
    },

    updateOption: async (id: string, label: string): Promise<void> => {
        try {
            const { getFunctions, httpsCallable } = await import("firebase/functions");
            const functions = getFunctions(undefined, 'southamerica-east1');
            const updateFunc = httpsCallable(functions, 'updateOption');
            
            await updateFunc({ optionId: id, label });
        } catch (error) {
            console.error("Error updating option:", error);
            throw error;
        }
    },

    deleteOption: async (id: string): Promise<void> => {
        try {
            const { getFunctions, httpsCallable } = await import("firebase/functions");
            const functions = getFunctions(undefined, 'southamerica-east1');
            const deleteFunc = httpsCallable(functions, 'deleteOption');
            
            await deleteFunc({ optionId: id });
        } catch (error) {
            console.error("Error deleting option:", error);
            throw error;
        }
    }
};
