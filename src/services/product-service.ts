import { db } from "@/lib/firebase";
import { callApi } from "@/lib/api-client";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  getDoc,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";
import { PaginatedResult } from "./client-service";

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

function mapProductDoc(d: QueryDocumentSnapshot<DocumentData>): Product {
  const data = d.data();
  return {
    id: d.id,
    ...data,
    createdAt: data.createdAt?.toDate
      ? data.createdAt.toDate().toISOString()
      : data.createdAt,
    updatedAt: data.updatedAt?.toDate
      ? data.updatedAt.toDate().toISOString()
      : data.updatedAt,
  } as Product;
}

export const ProductService = {
  // Get all products for a specific tenant
  getProducts: async (tenantId: string): Promise<Product[]> => {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("tenantId", "==", tenantId),
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(mapProductDoc);
    } catch (error) {
      console.error("Error fetching products:", error);
      throw error;
    }
  },

  getProductsPaginated: async (
    tenantId: string,
    pageSize: number = 12,
    cursor?: QueryDocumentSnapshot<DocumentData> | null,
  ): Promise<PaginatedResult<Product>> => {
    try {
      const q = cursor
        ? query(
            collection(db, COLLECTION_NAME),
            where("tenantId", "==", tenantId),
            orderBy("createdAt", "desc"),
            startAfter(cursor),
            limit(pageSize + 1),
          )
        : query(
            collection(db, COLLECTION_NAME),
            where("tenantId", "==", tenantId),
            orderBy("createdAt", "desc"),
            limit(pageSize + 1),
          );

      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs;
      const hasMore = docs.length > pageSize;
      const pageDocs = hasMore ? docs.slice(0, pageSize) : docs;

      return {
        data: pageDocs.map(mapProductDoc),
        lastDoc: pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null,
        hasMore,
      };
    } catch (error) {
      console.error("Error fetching products paginated:", error);
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
