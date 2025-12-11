import { db } from "@/lib/firebase";
import { collection, addDoc, deleteDoc, doc, getDocs, query, where, updateDoc } from "firebase/firestore";

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
        const newOption = {
            tenantId,
            type,
            label,
            createdAt: new Date().toISOString()
        };
        
        const docRef = await addDoc(collection(db, COLLECTION_NAME), newOption);
        return { id: docRef.id, ...newOption };
    },

    updateOption: async (id: string, label: string): Promise<void> => {
        const docRef = doc(db, COLLECTION_NAME, id);
        await updateDoc(docRef, { label });
    },

    deleteOption: async (id: string): Promise<void> => {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
    }
};
