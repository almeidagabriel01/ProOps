import { db } from "@/lib/firebase";
import { callApi } from "@/lib/api-client";
import { isFirestorePermissionError } from "@/lib/firestore-error";
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

export type Service = {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  price: string;
  category: string;
  images: string[];
  image?: string | null;
  status?: "active" | "inactive";
  createdAt?: string;
  updatedAt?: string;
  itemType?: "service";
};

const COLLECTION_NAME = "services";

function mapServiceDoc(d: QueryDocumentSnapshot<DocumentData>): Service {
  const data = d.data();
  return {
    id: d.id,
    tenantId: data.tenantId,
    name: data.name || "",
    description: data.description || "",
    price: data.price || "",
    category: data.category || "",
    images: Array.isArray(data.images) ? data.images : [],
    image: data.image || null,
    status: data.status,
    itemType: "service",
    createdAt: data.createdAt?.toDate
      ? data.createdAt.toDate().toISOString()
      : data.createdAt,
    updatedAt: data.updatedAt?.toDate
      ? data.updatedAt.toDate().toISOString()
      : data.updatedAt,
  };
}

export const ServiceService = {
  getServices: async (tenantId: string): Promise<Service[]> => {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("tenantId", "==", tenantId),
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(mapServiceDoc);
    } catch (error) {
      if (isFirestorePermissionError(error)) {
        console.warn("[ServiceService] Permission denied reading services.");
        return [];
      }
      console.error("Error fetching services:", error);
      throw error;
    }
  },

  getServicesPaginated: async (
    tenantId: string,
    pageSize: number = 12,
    cursor?: QueryDocumentSnapshot<DocumentData> | null,
    sortConfig?: { key: string; direction: "asc" | "desc" } | null,
  ): Promise<PaginatedResult<Service>> => {
    try {
      const sortField = sortConfig?.key || "createdAt";
      const sortDirection = sortConfig?.direction || "desc";

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
        data: pageDocs.map(mapServiceDoc),
        lastDoc: pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null,
        hasMore,
      };
    } catch (error) {
      console.error("Error fetching services paginated:", error);
      throw error;
    }
  },

  getServiceById: async (id: string): Promise<Service | null> => {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data();
      return {
        id: docSnap.id,
        tenantId: data.tenantId,
        name: data.name || "",
        description: data.description || "",
        price: data.price || "",
        category: data.category || "",
        images: Array.isArray(data.images) ? data.images : [],
        image: data.image || null,
        status: data.status,
        itemType: "service",
        createdAt: data.createdAt?.toDate
          ? data.createdAt.toDate().toISOString()
          : data.createdAt,
        updatedAt: data.updatedAt?.toDate
          ? data.updatedAt.toDate().toISOString()
          : data.updatedAt,
      };
    } catch (error) {
      console.error("Error fetching service:", error);
      throw error;
    }
  },

  updateService: async (id: string, data: Partial<Service>): Promise<void> => {
    try {
      await callApi(`v1/services/${id}`, "PUT", data);
    } catch (error) {
      console.error("Error updating service:", error);
      throw error;
    }
  },
};
