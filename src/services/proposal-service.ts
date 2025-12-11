import { db } from "@/lib/firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, getDoc } from "firebase/firestore";

// Define compatible types based on usage
export type ProposalStatus = 'draft' | 'sent' | 'approved' | 'rejected';

export type ProposalProduct = {
    productId: string;
    productName: string;
    productImage?: string;
    productDescription?: string;
    quantity: number;
    unitPrice: number;
    total: number;
    manufacturer?: string;
    category?: string;
}

export type Proposal = {
    id: string;
    tenantId: string;
    title: string;
    clientName: string;
    clientEmail?: string;
    clientPhone?: string;
    clientAddress?: string;
    validUntil: string;
    status: ProposalStatus;
    products: ProposalProduct[];
    customNotes?: string;
    discount?: number;
    createdAt: string;
    updatedAt: string;
    // Add other fields as needed from the original MockDB type
    // PDF Customization Settings
    pdfSettings?: {
        theme?: string;
        primaryColor?: string;
        fontFamily?: string;
        coverTitle?: string;
        coverImage?: string;
        coverLogo?: string;
        coverImageOpacity?: number;
        coverImageFit?: "cover" | "contain";
        coverImagePosition?: string;
        repeatHeader?: boolean;
        sections?: any[]; // Storing section data structure
    };
}

const COLLECTION_NAME = "proposals";

export const ProposalService = {
    getProposals: async (tenantId: string): Promise<Proposal[]> => {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where("tenantId", "==", tenantId)
            );
            
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Proposal));
        } catch (error) {
            console.error("Error fetching proposals:", error);
            throw error;
        }
    },

    getProposalById: async (id: string): Promise<Proposal | null> => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() } as Proposal;
            } else {
                return null;
            }
        } catch (error) {
            console.error("Error fetching proposal:", error);
            throw error;
        }
    },

    createProposal: async (proposal: Omit<Proposal, "id">): Promise<Proposal> => {
        try {
            const docRef = await addDoc(collection(db, COLLECTION_NAME), proposal);
            return { id: docRef.id, ...proposal };
        } catch (error) {
            console.error("Error creating proposal:", error);
            throw error;
        }
    },

    updateProposal: async (id: string, updates: Partial<Omit<Proposal, "id">>) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await updateDoc(docRef, updates);
            return { id, ...updates };
        } catch (error) {
            console.error("Error updating proposal:", error);
            throw error;
        }
    },

    deleteProposal: async (id: string) => {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
            return true;
        } catch (error) {
            console.error("Error deleting proposal:", error);
            throw error;
        }
    }
};
