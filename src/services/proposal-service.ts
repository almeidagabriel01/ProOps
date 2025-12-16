import { db } from "@/lib/firebase";
import { collection, doc, getDocs, query, where, getDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

// Define compatible types based on usage
export type ProposalStatus = 'draft' | 'sent' | 'approved' | 'rejected';

export type ProposalProduct = {
    productId: string;
    productName: string;
    productImage?: string;
    productImages?: string[];
    productDescription?: string;
    quantity: number;
    unitPrice: number;
    total: number;
    manufacturer?: string;
    category?: string;
    systemInstanceId?: string;
    isExtra?: boolean;
}

export type Proposal = {
    id: string;
    tenantId: string;
    title: string;
    clientId?: string; // Reference to the client in the clients collection
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
    // Sistemas de automação (para nicho automacao_residencial)
    sistemas?: {
        sistemaId: string;
        sistemaName: string;
        ambienteId: string;
        ambienteName: string;
        description?: string;
        productIds: string[]; // IDs dos produtos que pertencem a este sistema
    }[];
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
        sections?: any[]; // Storing section data structure for PDF Editor
    };
    sections?: any[]; // Legacy support or Section Builder support
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
            return querySnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
                    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
                } as Proposal;
            });
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
                const data = docSnap.data();
                return { 
                    id: docSnap.id, 
                    ...data,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
                    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
                } as Proposal;
            } else {
                return null;
            }
        } catch (error) {
            console.error("Error fetching proposal:", error);
            throw error;
        }
    },

    deleteProposal: async (id: string): Promise<void> => {
        try {
            const functions = getFunctions(undefined, 'southamerica-east1');
            const deleteFunc = httpsCallable(functions, 'deleteProposal');
            await deleteFunc({ proposalId: id });
        } catch (error) {
            console.error("Error deleting proposal:", error);
            throw error;
        }
    },

    updateProposal: async (id: string, data: Partial<Proposal>): Promise<void> => {
        try {
            const functions = getFunctions(undefined, 'southamerica-east1');
            const updateFunc = httpsCallable(functions, 'updateProposal');
            await updateFunc({ proposalId: id, ...data });
        } catch (error) {
            console.error("Error updating proposal:", error);
            throw error;
        }
    },

    // Check if a product is used in any proposal
    isProductUsedInProposal: async (tenantId: string, productId: string): Promise<boolean> => {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where("tenantId", "==", tenantId)
            );
            const querySnapshot = await getDocs(q);

            // Client-side filtering because querying array of objects is complex in Firestore
            // without knowing the exact object structure including quantity/price
            return querySnapshot.docs.some(doc => {
                const proposal = doc.data() as Proposal;
                return proposal.products?.some(p => p.productId === productId);
            });
        } catch (error) {
            console.error("Error checking product usage:", error);
            return false; 
        }
    }
};
