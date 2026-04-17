"use client";

import { db } from "@/lib/firebase";
import { callApi } from "@/lib/api-client";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";
import { Proposal, ProposalProduct } from "@/types/proposal";
import { PaginatedResult } from "./client-service";
import { isEnvironmentProposalSystemInstance } from "@/lib/proposal-environment-utils";

const COLLECTION_NAME = "proposals";

export * from "@/types/proposal";

// Simple event bus for proposal updates
type ProposalChangeListener = () => void;
const listeners: Set<ProposalChangeListener> = new Set();

let savingPromise: Promise<void> | null = null;

const notifyListeners = () => {
  listeners.forEach((l) => l());
};

function sortStringsPtBr(values: string[]): string[] {
  return [...values].sort((a, b) =>
    a.localeCompare(b, "pt-BR", {
      sensitivity: "base",
      numeric: true,
    }),
  );
}

function normalizeLabelList(values: unknown[]): string[] {
  const labels = values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);

  return sortStringsPtBr(Array.from(new Set(labels)));
}

function extractSystemNames(data: DocumentData): string[] {
  const fromSistemas = Array.isArray(data.sistemas)
    ? data.sistemas
        .filter(
          (sistema: {
            sistemaId?: unknown;
            sistemaName?: unknown;
            ambientes?: Array<{ ambienteId?: unknown; ambienteName?: unknown }>;
          }) =>
            !isEnvironmentProposalSystemInstance({
              sistemaId:
                typeof sistema?.sistemaId === "string" ? sistema.sistemaId : "",
              sistemaName:
                typeof sistema?.sistemaName === "string"
                  ? sistema.sistemaName
                  : "",
              ambientes: Array.isArray(sistema?.ambientes)
                ? sistema.ambientes
                    .filter((ambiente) => ambiente && typeof ambiente === "object")
                    .map((ambiente) => ({
                      ambienteId:
                        typeof ambiente?.ambienteId === "string"
                          ? ambiente.ambienteId
                          : "",
                      ambienteName:
                        typeof ambiente?.ambienteName === "string"
                          ? ambiente.ambienteName
                          : "",
                    }))
                : [],
            }),
        )
        .map((sistema: { sistemaName?: unknown }) => sistema?.sistemaName)
        .filter((name): name is string => typeof name === "string")
    : [];

  const normalized = normalizeLabelList(fromSistemas);
  if (normalized.length > 0) {
    return normalized;
  }

  return normalizeLabelList([data.primarySystem]);
}

function extractEnvironmentNames(data: DocumentData): string[] {
  const fromSistemas = Array.isArray(data.sistemas)
    ? data.sistemas.flatMap((sistema: {
        ambientes?: Array<{ ambienteName?: unknown }>;
        ambienteName?: unknown;
      }) => {
        const nested = Array.isArray(sistema?.ambientes)
          ? sistema.ambientes
              .map(
                (ambiente: { ambienteName?: unknown }) =>
                  ambiente?.ambienteName,
              )
              .filter((name): name is string => typeof name === "string")
          : [];

        if (nested.length > 0) {
          return nested;
        }

        return typeof sistema?.ambienteName === "string"
          ? [sistema.ambienteName]
          : [];
      })
    : [];

  const normalized = normalizeLabelList(fromSistemas);
  if (normalized.length > 0) {
    return normalized;
  }

  return normalizeLabelList([data.primaryEnvironment]);
}

function getPrimarySystemFromData(data: DocumentData): string {
  return extractSystemNames(data).join(", ");
}

function getPrimaryEnvironmentFromData(data: DocumentData): string {
  return extractEnvironmentNames(data).join(", ");
}

function compareProposalsByField(
  a: QueryDocumentSnapshot<DocumentData>,
  b: QueryDocumentSnapshot<DocumentData>,
  sortField: string,
  sortDirection: "asc" | "desc",
): number {
  const dataA = a.data();
  const dataB = b.data();

  let valueA: unknown = dataA[sortField];
  let valueB: unknown = dataB[sortField];

  if (sortField === "primarySystem") {
    valueA = getPrimarySystemFromData(dataA);
    valueB = getPrimarySystemFromData(dataB);
  }

  if (sortField === "primaryEnvironment") {
    valueA = getPrimaryEnvironmentFromData(dataA);
    valueB = getPrimaryEnvironmentFromData(dataB);
  }

  if (valueA === null || valueA === undefined || valueA === "") {
    return 1;
  }
  if (valueB === null || valueB === undefined || valueB === "") {
    return -1;
  }

  if (typeof valueA === "string" && typeof valueB === "string") {
    const alphabetical = valueA.localeCompare(valueB, "pt-BR", {
      sensitivity: "base",
      numeric: true,
    });

    if (alphabetical !== 0) {
      return sortDirection === "asc" ? alphabetical : -alphabetical;
    }

    const titleA = typeof dataA.title === "string" ? dataA.title : "";
    const titleB = typeof dataB.title === "string" ? dataB.title : "";
    const byTitle = titleA.localeCompare(titleB, "pt-BR", {
      sensitivity: "base",
      numeric: true,
    });

    if (byTitle !== 0) {
      return byTitle;
    }

    return a.id.localeCompare(b.id, "pt-BR", { sensitivity: "base" });
  }

  if (valueA < valueB) return sortDirection === "asc" ? -1 : 1;
  if (valueA > valueB) return sortDirection === "asc" ? 1 : -1;

  return 0;
}

function mapProposalDoc(d: QueryDocumentSnapshot<DocumentData>): Proposal {
  const data = d.data();
  return {
    id: d.id,
    ...data,
    clientName: (data.clientName as string) || "",
    primarySystem: getPrimarySystemFromData(data),
    primaryEnvironment: getPrimaryEnvironmentFromData(data),
    createdAt: data.createdAt?.toDate
      ? data.createdAt.toDate().toISOString()
      : data.createdAt,
    updatedAt: data.updatedAt?.toDate
      ? data.updatedAt.toDate().toISOString()
      : data.updatedAt,
  } as Proposal;
}

export const ProposalService = {
  // Saving synchronization
  notifySavingStarted: () => {
    let resolve: () => void;
    savingPromise = new Promise((r) => {
      resolve = r;
    });
    return () => {
      resolve();
      savingPromise = null;
    };
  },

  waitForSave: async () => {
    if (savingPromise) {
      await savingPromise;
    }
  },

  // Subscription method
  subscribe: (listener: ProposalChangeListener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  // ... existing methods

  getProposals: async (tenantId: string): Promise<Proposal[]> => {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("tenantId", "==", tenantId),
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(mapProposalDoc);
    } catch (error) {
      console.error("Error fetching proposals:", error);
      throw error;
    }
  },

  getProposalsPaginated: async (
    tenantId: string,
    pageSize: number = 12,
    cursor?: QueryDocumentSnapshot<DocumentData> | null,
    sortConfig?: { key: string; direction: "asc" | "desc" } | null,
  ): Promise<PaginatedResult<Proposal>> => {
    try {
      const sortField = sortConfig?.key || "createdAt";
      const sortDirection = sortConfig?.direction || "desc";

      const needsClientSort =
        sortField === "primaryEnvironment" || sortField === "primarySystem";

      if (needsClientSort) {
        const baseQuery = query(
          collection(db, COLLECTION_NAME),
          where("tenantId", "==", tenantId),
        );

        const allSnapshot = await getDocs(baseQuery);
        const sortedDocs = [...allSnapshot.docs].sort((a, b) =>
          compareProposalsByField(a, b, sortField, sortDirection),
        );

        const startIndex = cursor
          ? sortedDocs.findIndex((doc) => doc.id === cursor.id) + 1
          : 0;

        const pageDocs = sortedDocs.slice(startIndex, startIndex + pageSize);
        const hasMore = startIndex + pageSize < sortedDocs.length;

        return {
          data: pageDocs.map(mapProposalDoc),
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
        data: pageDocs.map(mapProposalDoc),
        lastDoc: pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null,
        hasMore,
      };
    } catch (error) {
      console.error("Error fetching proposals paginated:", error);
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
          createdAt: data.createdAt?.toDate
            ? data.createdAt.toDate().toISOString()
            : data.createdAt,
        } as Proposal;
      }
      return null;
    } catch (error) {
      console.error("Error fetching proposal:", error);
      throw error;
    }
  },

  createProposal: async (data: Partial<Proposal>): Promise<Proposal> => {
    try {
      const payload = {
        ...data,
      };

      // Populate flattened fields for sorting if systems exist
      if (data.sistemas && data.sistemas.length > 0) {
        payload.primarySystem = isEnvironmentProposalSystemInstance(
          data.sistemas[0],
        )
          ? ""
          : data.sistemas[0].sistemaName;
        // Check if environment exists in the first system
        if (
          data.sistemas[0].ambientes &&
          data.sistemas[0].ambientes.length > 0
        ) {
          payload.primaryEnvironment =
            data.sistemas[0].ambientes[0].ambienteName;
        } else {
          // Legacy support
          payload.primaryEnvironment = data.sistemas[0].ambienteName || "";
        }
      }

      const result = await callApi<{ success: boolean; proposalId: string }>(
        "/v1/proposals",
        "POST",
        payload,
      );

      notifyListeners(); // Notify list to refresh

      return {
        id: result.proposalId,
        ...payload,
      } as Proposal;
    } catch (error) {
      console.error("Error creating proposal:", error);
      throw error;
    }
  },

  updateProposal: async (
    id: string,
    data: Partial<Proposal>,
  ): Promise<void> => {
    try {
      const payload = { ...data };

      // Update flattened fields if sistemas is being updated
      if (data.sistemas && data.sistemas.length > 0) {
        payload.primarySystem = isEnvironmentProposalSystemInstance(
          data.sistemas[0],
        )
          ? ""
          : data.sistemas[0].sistemaName;
        if (
          data.sistemas[0].ambientes &&
          data.sistemas[0].ambientes.length > 0
        ) {
          payload.primaryEnvironment =
            data.sistemas[0].ambientes[0].ambienteName;
        } else {
          payload.primaryEnvironment = data.sistemas[0].ambienteName || "";
        }
      } else if (data.sistemas && data.sistemas.length === 0) {
        // If clearing systems, clear sorting fields
        payload.primarySystem = "";
        payload.primaryEnvironment = "";
      }

      await callApi(`/v1/proposals/${id}`, "PUT", payload);
      notifyListeners(); // Notify list to refresh
    } catch (error) {
      console.error("Error updating proposal:", error);
      throw error;
    }
  },

  deleteProposal: async (id: string): Promise<void> => {
    try {
      await callApi(`/v1/proposals/${id}`, "DELETE");
      notifyListeners(); // Notify list to refresh
    } catch (error) {
      console.error("Error deleting proposal:", error);
      throw error;
    }
  },

  isClientUsedInProposal: async (
    clientId: string,
    tenantId: string,
  ): Promise<boolean> => {
    // Validate both parameters are provided
    if (!clientId || !tenantId) {
      console.warn(
        "isClientUsedInProposal called without clientId or tenantId",
      );
      return false;
    }

    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("tenantId", "==", tenantId),
        where("clientId", "==", clientId),
      );
      const snap = await getDocs(q);
      return !snap.empty;
    } catch (error) {
      console.error("Error checking client usage:", error);
      // Block deletion to be safe if we can't verify
      return true;
    }
  },

  isProductUsedInProposal: async (
    productId: string,
    tenantId?: string,
    itemType: "product" | "service" = "product",
  ): Promise<boolean> => {
    // Basic validation
    if (!productId || !tenantId) {
      console.warn(
        "isProductUsedInProposal called without productId or tenantId",
      );
      return false;
    }

    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("tenantId", "==", tenantId),
      );

      const querySnapshot = await getDocs(q);

      // Client-side filtering because Firestore can't query inside array of objects easily
      // without specific structure or third-party search (like Algolia)
      for (const doc of querySnapshot.docs) {
        const data = doc.data();
        const products = data.products || [];
        // Check if any product in the array matches exactly the productId
        if (
          Array.isArray(products) &&
          products.some(
            (p: ProposalProduct) =>
              p.productId === productId && (p.itemType || "product") === itemType,
          )
        ) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error("Error checking product usage:", error);
      // In case of error, better NOT to block deletion unless we are sure, or block to be safe?
      // Blocking to be safe is better to prevent data integrity issues.
      return true;
    }
  },
};
