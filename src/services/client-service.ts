"use client";

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

export type ClientSource = "manual" | "proposal" | "financial";

export type ClientType = "cliente" | "fornecedor";

export type Client = {
  id: string;
  tenantId: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  types: ClientType[]; // Array to allow both client and supplier
  source: ClientSource;
  sourceId?: string; // ID of the proposal or financial transaction that created this client
  createdAt: string;
  updatedAt: string;
};

export interface PaginatedResult<T> {
  data: T[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

const COLLECTION_NAME = "clients";

function mapClientDoc(d: QueryDocumentSnapshot<DocumentData>): Client {
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
  } as Client;
}

export const ClientService = {
  getClients: async (tenantId: string): Promise<Client[]> => {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("tenantId", "==", tenantId),
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(mapClientDoc);
    } catch (error) {
      console.error("Error fetching clients:", error);
      throw error;
    }
  },

  getClientsPaginated: async (
    tenantId: string,
    pageSize: number = 12,
    cursor?: QueryDocumentSnapshot<DocumentData> | null,
    sortConfig?: { key: string; direction: "asc" | "desc" } | null,
  ): Promise<PaginatedResult<Client>> => {
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
        data: pageDocs.map(mapClientDoc),
        lastDoc: pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null,
        hasMore,
      };
    } catch (error) {
      console.error("Error fetching clients paginated:", error);
      throw error;
    }
  },

  getClientById: async (id: string): Promise<Client | null> => {
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
        } as Client;
      }
      return null;
    } catch (error) {
      console.error("Error fetching client:", error);
      throw error;
    }
  },

  getClientByEmail: async (
    tenantId: string,
    email: string,
  ): Promise<Client | null> => {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("tenantId", "==", tenantId),
        where("email", "==", email.toLowerCase().trim()),
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() } as Client;
    } catch (error) {
      console.error("Error fetching client by email:", error);
      throw error;
    }
  },

  getClientByName: async (
    tenantId: string,
    name: string,
  ): Promise<Client | null> => {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("tenantId", "==", tenantId),
        where("name", "==", name.trim()),
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() } as Client;
    } catch (error) {
      console.error("Error fetching client by name:", error);
      throw error;
    }
  },

  updateClient: async (id: string, data: Partial<Client>): Promise<void> => {
    try {
      await callApi(`v1/clients/${id}`, "PUT", data);
    } catch (error) {
      console.error("Error updating client:", error);
      throw error;
    }
  },
};
