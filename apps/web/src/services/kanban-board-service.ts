"use client";

import { db } from "@/lib/firebase";
import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from "firebase/firestore";
import type {
  DocumentData,
  QueryConstraint,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { withDerivedOverdue } from "@/services/transaction-service";
import type {
  Transaction,
  TransactionStatus,
} from "@/services/transaction-service";
import type { Proposal } from "@/types/proposal";

// ============================================
// TYPES
// ============================================

/** Cap de cards carregados por coluna a cada página do board CRM. */
export const KANBAN_COLUMN_PAGE_SIZE = 30;

export type KanbanColumnCursor = QueryDocumentSnapshot<DocumentData>;

export interface KanbanColumnPage<T> {
  items: T[];
  /** Cursor da última doc da página — passar de volta em `startAfter`. */
  cursor: KanbanColumnCursor | null;
  hasMore: boolean;
}

export interface KanbanPageOptions {
  cursor?: KanbanColumnCursor | null;
  pageSize?: number;
}

// ============================================
// COLLECTIONS
// ============================================

const PROPOSALS_COLLECTION = "proposals";
const TRANSACTIONS_COLLECTION = "transactions";

// ============================================
// HELPERS
// ============================================

function uniqueStatuses(statusValues: string[]): string[] {
  return Array.from(new Set(statusValues.filter(Boolean)));
}

function statusConstraint(values: string[]): QueryConstraint {
  return values.length === 1
    ? where("status", "==", values[0])
    : where("status", "in", values);
}

/** Firestore Timestamp → ISO string; passa adiante valores já serializados. */
function toIsoDate(value: unknown): unknown {
  return value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
    ? (value as { toDate(): Date }).toDate().toISOString()
    : value;
}

async function fetchColumnPage(
  collectionName: string,
  tenantId: string,
  statusValues: string[],
  orderByField: string,
  options?: KanbanPageOptions,
): Promise<KanbanColumnPage<DocumentData & { id: string }>> {
  const pageSize = options?.pageSize ?? KANBAN_COLUMN_PAGE_SIZE;
  const constraints: QueryConstraint[] = [
    where("tenantId", "==", tenantId),
    statusConstraint(statusValues),
    orderBy(orderByField, "desc"),
  ];
  if (options?.cursor) constraints.push(startAfter(options.cursor));
  constraints.push(limit(pageSize));

  const snapshot = await getDocs(
    query(collection(db, collectionName), ...constraints),
  );
  const docs = snapshot.docs;
  return {
    items: docs.map((d) => ({ id: d.id, ...d.data() })),
    cursor: docs.length > 0 ? docs[docs.length - 1] : null,
    hasMore: docs.length === pageSize,
  };
}

async function countColumn(
  collectionName: string,
  tenantId: string,
  statusValues: string[],
): Promise<number> {
  const snapshot = await getCountFromServer(
    query(
      collection(db, collectionName),
      where("tenantId", "==", tenantId),
      statusConstraint(statusValues),
    ),
  );
  return snapshot.data().count;
}

// ============================================
// SERVICE
// ============================================

/**
 * Queries por coluna do board CRM — o kanban nunca baixa a coleção inteira:
 * cada coluna carrega páginas de KANBAN_COLUMN_PAGE_SIZE docs (cursor
 * startAfter) e o total real vem de aggregation (getCountFromServer).
 */
export const KanbanBoardService = {
  /**
   * Página de propostas de uma coluna. `statusValues` cobre o id da coluna
   * persistida e o `mappedStatus` legado (ex.: ["<docId>", "sent"]).
   * Ordenação: createdAt desc — índice (tenantId, status, createdAt DESC).
   */
  async getProposalColumnPage(
    tenantId: string,
    statusValues: string[],
    options?: KanbanPageOptions,
  ): Promise<KanbanColumnPage<Proposal>> {
    const values = uniqueStatuses(statusValues);
    if (!tenantId || values.length === 0) {
      return { items: [], cursor: null, hasMore: false };
    }
    const page = await fetchColumnPage(
      PROPOSALS_COLLECTION,
      tenantId,
      values,
      "createdAt",
      options,
    );
    return {
      ...page,
      items: page.items.map(
        (data) =>
          ({
            ...data,
            clientName: (data.clientName as string) || "",
            createdAt: toIsoDate(data.createdAt),
            updatedAt: toIsoDate(data.updatedAt),
          }) as Proposal,
      ),
    };
  },

  /** Total real da coluna de propostas via aggregation — 1 leitura/1000 docs. */
  async countProposalColumn(
    tenantId: string,
    statusValues: string[],
  ): Promise<number> {
    const values = uniqueStatuses(statusValues);
    if (!tenantId || values.length === 0) return 0;
    return countColumn(PROPOSALS_COLLECTION, tenantId, values);
  },

  /**
   * Página de lançamentos de uma coluna (status fixo pending/overdue/paid).
   * Ordenação: date desc — índice (tenantId, status, date DESC).
   */
  async getTransactionColumnPage(
    tenantId: string,
    status: TransactionStatus,
    options?: KanbanPageOptions,
  ): Promise<KanbanColumnPage<Transaction>> {
    if (!tenantId) return { items: [], cursor: null, hasMore: false };
    const page = await fetchColumnPage(
      TRANSACTIONS_COLLECTION,
      tenantId,
      [status],
      "date",
      options,
    );
    return {
      ...page,
      items: page.items.map((data) => withDerivedOverdue(data as Transaction)),
    };
  },

  /** Total real da coluna de lançamentos via aggregation. */
  async countTransactionColumn(
    tenantId: string,
    status: TransactionStatus,
  ): Promise<number> {
    if (!tenantId) return 0;
    return countColumn(TRANSACTIONS_COLLECTION, tenantId, [status]);
  },
};
