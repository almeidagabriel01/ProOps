"use client";

import { db } from "@/lib/firebase";
import { callApi } from "@/lib/api-client";
import {
  collection,
  doc,
  getCountFromServer,
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
import { firstSearchToken, normalizeSearchWords } from "@/lib/search-term";

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

/**
 * Deriva os campos desnormalizados de ordenação a partir de `sistemas`
 * (fallback: campos primários já existentes no doc). FONTE DA VERDADE da
 * derivação — persistida no doc pelo backend em todo create/update que
 * contém `sistemas`, habilitando `orderBy` server-side na listagem.
 * Propostas sem sistemas recebem "" (mantém o doc no índice de ordenação).
 */
export function computeProposalSortFields(data: DocumentData): {
  primarySystem: string;
  primaryEnvironment: string;
} {
  return {
    primarySystem: getPrimarySystemFromData(data),
    primaryEnvironment: getPrimaryEnvironmentFromData(data),
  };
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

  /** Contagem server-side (aggregation) — 1 leitura por 1000 docs. */
  countProposals: async (tenantId: string): Promise<number> => {
    const snap = await getCountFromServer(
      query(collection(db, COLLECTION_NAME), where("tenantId", "==", tenantId)),
    );
    return snap.data().count;
  },

  /**
   * Conta propostas cujo status está no conjunto — usado pelas estatísticas
   * do dashboard (statuses dinâmicos do kanban). Chunks de 30 (limite do "in").
   */
  countProposalsByStatuses: async (
    tenantId: string,
    statuses: string[],
  ): Promise<number> => {
    const unique = Array.from(new Set(statuses.filter(Boolean)));
    if (unique.length === 0) return 0;
    const CHUNK = 30;
    let total = 0;
    for (let i = 0; i < unique.length; i += CHUNK) {
      const snap = await getCountFromServer(
        query(
          collection(db, COLLECTION_NAME),
          where("tenantId", "==", tenantId),
          where("status", "in", unique.slice(i, i + CHUNK)),
        ),
      );
      total += snap.data().count;
    }
    return total;
  },

  /** Últimas N propostas por createdAt desc — dashboard não baixa mais a coleção. */
  getRecentProposals: async (
    tenantId: string,
    count = 5,
  ): Promise<Proposal[]> => {
    const snap = await getDocs(
      query(
        collection(db, COLLECTION_NAME),
        where("tenantId", "==", tenantId),
        orderBy("createdAt", "desc"),
        limit(count),
      ),
    );
    return snap.docs.map(mapProposalDoc);
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

      // primarySystem/primaryEnvironment são desnormalizados no doc
      // (computeProposalSortFields + backfill-proposal-sort-fields) — o sort
      // é sempre server-side via orderBy; índices (tenantId, campo ASC/DESC)
      // já existem em firestore.indexes.json.
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

  /**
   * Busca textual indexada — não baixa a coleção: usa a primeira palavra
   * normalizada do termo com `array-contains` sobre `searchTokens` (tokens
   * de prefixo gravados pelo backend, ver functions/src/lib/search-tokens.ts
   * + backfill-search-tokens) e refina client-side exigindo TODAS as
   * palavras em title/clientName. Termo sem palavra com >= 2 chars → []
   * sem query.
   */
  searchProposals: async (
    tenantId: string,
    term: string,
    max = 100,
  ): Promise<Proposal[]> => {
    const token = firstSearchToken(term);
    if (!token) return [];

    const snap = await getDocs(
      query(
        collection(db, COLLECTION_NAME),
        where("tenantId", "==", tenantId),
        where("searchTokens", "array-contains", token),
        limit(max),
      ),
    );

    const words = normalizeSearchWords(term);
    return snap.docs.map(mapProposalDoc).filter((proposal) => {
      const haystacks = [proposal.title || "", proposal.clientName || ""].map(
        (value) => normalizeSearchWords(value).join(" "),
      );
      return words.every((word) =>
        haystacks.some((haystack) => haystack.includes(word)),
      );
    });
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
      // Create salva a proposta inteira — sempre computa os campos
      // desnormalizados de ordenação a partir de sistemas.
      const payload = {
        ...data,
        ...computeProposalSortFields(data),
      };

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

      // Recomputa os campos desnormalizados de ordenação sempre que o
      // payload contém sistemas (inclusive [] — limpa para "").
      if (typeof data.sistemas !== "undefined") {
        Object.assign(payload, computeProposalSortFields(data));
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
