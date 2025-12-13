import { db } from "@/lib/firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, getDoc, query, where } from "firebase/firestore";
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
            const ambientes = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Ambiente));
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
            const docRef = await addDoc(collection(db, COLLECTION_NAME), {
                ...data,
                createdAt: new Date().toISOString()
            });
            return { id: docRef.id, ...data };
        } catch (error) {
            console.error("Error creating ambiente:", error);
            throw error;
        }
    },

    updateAmbiente: async (id: string, data: Partial<Omit<Ambiente, "id">>): Promise<void> => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await updateDoc(docRef, data);
        } catch (error) {
            console.error("Error updating ambiente:", error);
            throw error;
        }
    },

    deleteAmbiente: async (id: string): Promise<void> => {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
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
            return Math.max(...ambientes.map(a => a.order)) + 1;
        } catch {
            return 0;
        }
    }
};
