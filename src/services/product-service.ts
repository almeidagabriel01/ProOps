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
  stock: number;
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
    // Coerce stock to number
    stock:
      typeof data.stock === "number" ? data.stock : Number(data.stock || 0),
    createdAt: data.createdAt?.toDate
      ? data.createdAt.toDate().toISOString()
      : data.createdAt,
    updatedAt: data.updatedAt?.toDate
      ? data.updatedAt.toDate().toISOString()
      : data.updatedAt,
  } as Product;
}

function compareProductsByField(
  a: QueryDocumentSnapshot<DocumentData>,
  b: QueryDocumentSnapshot<DocumentData>,
  sortField: string,
  sortDirection: "asc" | "desc",
): number {
  const dataA = a.data();
  const dataB = b.data();

  const rawA = dataA[sortField];
  const rawB = dataB[sortField];

  let valueA: unknown = rawA;
  let valueB: unknown = rawB;

  if (sortField === "stock") {
    valueA = typeof rawA === "number" ? rawA : Number(rawA ?? 0);
    valueB = typeof rawB === "number" ? rawB : Number(rawB ?? 0);
  }

  if (valueA === valueB) {
    return 0;
  }

  if (valueA === null || valueA === undefined) {
    return 1;
  }
  if (valueB === null || valueB === undefined) {
    return -1;
  }

  if (typeof valueA === "string" && typeof valueB === "string") {
    return sortDirection === "asc"
      ? valueA.localeCompare(valueB, undefined, { numeric: true })
      : valueB.localeCompare(valueA, undefined, { numeric: true });
  }

  if (valueA < valueB) return sortDirection === "asc" ? -1 : 1;
  if (valueA > valueB) return sortDirection === "asc" ? 1 : -1;

  return 0;
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
    sortConfig?: { key: string; direction: "asc" | "desc" } | null,
  ): Promise<PaginatedResult<Product>> => {
    try {
      const sortField = sortConfig?.key || "createdAt";
      const sortDirection = sortConfig?.direction || "desc";

      const needsClientSort = sortField === "stock";

      if (needsClientSort) {
        const baseQuery = query(
          collection(db, COLLECTION_NAME),
          where("tenantId", "==", tenantId),
        );

        const allSnapshot = await getDocs(baseQuery);
        const sortedDocs = [...allSnapshot.docs].sort((a, b) =>
          compareProductsByField(a, b, sortField, sortDirection),
        );

        const startIndex = cursor
          ? sortedDocs.findIndex((doc) => doc.id === cursor.id) + 1
          : 0;

        const pageDocs = sortedDocs.slice(startIndex, startIndex + pageSize);
        const hasMore = startIndex + pageSize < sortedDocs.length;

        return {
          data: pageDocs.map(mapProductDoc),
          lastDoc: pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null,
          hasMore,
        };
      }

      const q = cursor
        ? query(
            collection(db, COLLECTION_NAME),
            where("tenantId", "==", tenantId),
            orderBy(sortField, sortDirection),
            startAfter(cursor),
            limit(pageSize + 1),
          )
        : query(
            collection(db, COLLECTION_NAME),
            where("tenantId", "==", tenantId),
            orderBy(sortField, sortDirection),
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
