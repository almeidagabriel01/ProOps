import { db } from "@/lib/firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, getDoc, query, where } from "firebase/firestore";
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
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Sistema));
        } catch (error) {
            console.error("Error fetching sistemas:", error);
            throw error;
        }
    },

    // Obter sistemas filtrados por ambiente
    getSistemasByAmbiente: async (tenantId: string, ambienteId: string): Promise<Sistema[]> => {
        try {
            const sistemas = await SistemaService.getSistemas(tenantId);
            return sistemas.filter(s => s.ambienteIds.includes(ambienteId));
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
            const now = new Date().toISOString();
            const docRef = await addDoc(collection(db, COLLECTION_NAME), {
                ...data,
                createdAt: now,
                updatedAt: now
            });
            return { id: docRef.id, ...data };
        } catch (error) {
            console.error("Error creating sistema:", error);
            throw error;
        }
    },

    updateSistema: async (id: string, data: Partial<Omit<Sistema, "id">>): Promise<void> => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await updateDoc(docRef, {
                ...data,
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error("Error updating sistema:", error);
            throw error;
        }
    },

    deleteSistema: async (id: string): Promise<void> => {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
        } catch (error) {
            console.error("Error deleting sistema:", error);
            throw error;
        }
    }
};
