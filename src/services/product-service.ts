import { db } from "@/lib/firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, getDoc } from "firebase/firestore";

export type Product = {
    id: string;
    tenantId: string;
    name: string;
    description: string;
    price: string;
    manufacturer: string;
    category: string;
    sku: string;
    stock: string;
    image?: string | null;
}

const COLLECTION_NAME = "products";

export const ProductService = {
    // Get all products for a specific tenant
    getProducts: async (tenantId: string): Promise<Product[]> => {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where("tenantId", "==", tenantId)
            );
            
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Product));
        } catch (error) {
            console.error("Error fetching products:", error);
            throw error;
        }
    },

    // Get a single product by ID
    getProductById: async (id: string): Promise<Product | null> => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() } as Product;
            } else {
                return null;
            }
        } catch (error) {
            console.error("Error fetching product:", error);
            throw error;
        }
    },

    // Create a new product
    createProduct: async (product: Omit<Product, "id">): Promise<Product> => {
        try {
            const docRef = await addDoc(collection(db, COLLECTION_NAME), product);
            return { id: docRef.id, ...product };
        } catch (error) {
            console.error("Error creating product:", error);
            throw error;
        }
    },

    // Update an existing product
    updateProduct: async (id: string, updates: Partial<Omit<Product, "id">>) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await updateDoc(docRef, updates);
            return { id, ...updates };
        } catch (error) {
            console.error("Error updating product:", error);
            throw error;
        }
    },

    // Delete a product
    deleteProduct: async (id: string) => {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
            return true;
        } catch (error) {
            console.error("Error deleting product:", error);
            throw error;
        }
    }
};
