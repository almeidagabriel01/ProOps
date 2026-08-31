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
  DocumentSnapshot,
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
  /**
   * Campos fiscais — opcionais no cadastro, exigidos na emissao da NFS-e pelo
   * gate em `fiscal-readiness.ts`. Ficam aqui, e nao numa colecao propria,
   * porque sao atributos do proprio servico.
   */
  codigoLc116?: string;
  codigoTributacaoNacional?: string;
  aliquotaIss?: number;
};

/** Espelha `ProductWriteInput`: `aliquotaIss` aceita `null` para apagar. */
export type ServiceWriteInput = Omit<Partial<Service>, "aliquotaIss"> & {
  aliquotaIss?: number | null;
};

const COLLECTION_NAME = "services";

/**
 * Único ponto de leitura de um documento de serviço.
 *
 * Aceita os dois tipos de snapshot de propósito: havia uma segunda cópia deste
 * mapeamento dentro de `getServiceById`, e campo novo adicionado só aqui sumia
 * silenciosamente ao abrir o cadastro para edição — foi o que aconteceu com os
 * campos fiscais.
 */
export function mapServiceDoc(
  d: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>,
): Service {
  const data = d.data() ?? {};
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
    // O mapper de servico e explicito (o de produto usa spread), entao um campo
    // ausente aqui some silenciosamente ao reabrir o cadastro para edicao.
    codigoLc116: data.codigoLc116 ?? undefined,
    codigoTributacaoNacional: data.codigoTributacaoNacional ?? undefined,
    aliquotaIss:
      typeof data.aliquotaIss === "number" ? data.aliquotaIss : undefined,
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

      return mapServiceDoc(docSnap);
    } catch (error) {
      console.error("Error fetching service:", error);
      throw error;
    }
  },

  updateService: async (id: string, data: ServiceWriteInput): Promise<void> => {
    try {
      await callApi(`v1/services/${id}`, "PUT", data);
    } catch (error) {
      console.error("Error updating service:", error);
      throw error;
    }
  },
};
