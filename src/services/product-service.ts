import { db } from "@/lib/firebase";
import { callApi } from "@/lib/api-client";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  getDoc,
} from "firebase/firestore";

export type Product = {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  price: string;
  markup?: string; // Profit percentage over base price
  manufacturer: string;
  category: string;
  sku: string;
  stock: string;
  images: string[]; // Changed from single image to array
  image?: string | null; // Kept for backward compatibility (optional)
  /** @deprecated Status is now contextual (System/Proposal), not global */
  status?: "active" | "inactive";
  createdAt?: string;
  updatedAt?: string;
};

const COLLECTION_NAME = "products";

export const ProductService = {
  // Get all products for a specific tenant
  getProducts: async (tenantId: string): Promise<Product[]> => {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("tenantId", "==", tenantId),
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate
            ? data.createdAt.toDate().toISOString()
            : data.createdAt,
          updatedAt: data.updatedAt?.toDate
            ? data.updatedAt.toDate().toISOString()
            : data.updatedAt,
        } as Product;
      });
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
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate
            ? data.createdAt.toDate().toISOString()
            : data.createdAt,
          updatedAt: data.updatedAt?.toDate
            ? data.updatedAt.toDate().toISOString()
            : data.updatedAt,
        } as Product;
      } else {
        return null;
      }
    } catch (error) {
      console.error("Error fetching product:", error);
      throw error;
    }
  },

  updateProduct: async (id: string, data: Partial<Product>): Promise<void> => {
    try {
      await callApi(`v1/products/${id}`, "PUT", data);
    } catch (error) {
      console.error("Error updating product:", error);
      throw error;
    }
  },
};
