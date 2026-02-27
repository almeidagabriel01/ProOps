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

export type Service = {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  price: string;
  markup?: string;

  category: string;
  stock: number;
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
    ...data,
    stock:
      typeof data.stock === "number" ? data.stock : Number(data.stock || 0),
    itemType: "service",
    createdAt: data.createdAt?.toDate
      ? data.createdAt.toDate().toISOString()
      : data.createdAt,
    updatedAt: data.updatedAt?.toDate
      ? data.updatedAt.toDate().toISOString()
      : data.updatedAt,
  } as Service;
}

function compareServicesByField(
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

      const needsClientSort = sortField === "stock";

      if (needsClientSort) {
        const baseQuery = query(
          collection(db, COLLECTION_NAME),
          where("tenantId", "==", tenantId),
        );

        const allSnapshot = await getDocs(baseQuery);
        const sortedDocs = [...allSnapshot.docs].sort((a, b) =>
          compareServicesByField(a, b, sortField, sortDirection),
        );

        const startIndex = cursor
          ? sortedDocs.findIndex((doc) => doc.id === cursor.id) + 1
          : 0;

        const pageDocs = sortedDocs.slice(startIndex, startIndex + pageSize);
        const hasMore = startIndex + pageSize < sortedDocs.length;

        return {
          data: pageDocs.map(mapServiceDoc),
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

      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          itemType: "service",
          createdAt: data.createdAt?.toDate
            ? data.createdAt.toDate().toISOString()
            : data.createdAt,
          updatedAt: data.updatedAt?.toDate
            ? data.updatedAt.toDate().toISOString()
            : data.updatedAt,
        } as Service;
      } else {
        return null;
      }
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
