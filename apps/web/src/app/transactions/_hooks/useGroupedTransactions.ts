"use client";

import * as React from "react";
import type { QueryDocumentSnapshot } from "firebase/firestore";
import {
  Transaction,
  TransactionGroupSummary,
  TransactionService,
} from "@/services/transaction-service";

const PAGE_SIZE = 50;

interface UseGroupedTransactionsOptions {
  tenantId?: string;
  enabled: boolean;
  pageSize?: number;
}

interface UseGroupedTransactionsResult {
  groupSummaries: TransactionGroupSummary[];
  standalone: Transaction[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  /** Busca membros do grupo (expand). Cache em memória — re-expandir não refaz query. */
  ensureMembers: (groupKey: string) => Promise<Transaction[]>;
  getCachedMembers: (groupKey: string) => Transaction[] | undefined;
  /** Todos os membros já carregados (pool de seleção/somatórios da página). */
  getAllCachedMembers: () => Transaction[];
  /** Incrementa a cada mutação do cache de membros — dependência de memos. */
  membersVersion: number;
  /**
   * Refaz as listas carregadas e REVALIDA os membros já cacheados
   * (stale-while-revalidate: grupos expandidos não piscam vazios).
   */
  refresh: () => Promise<void>;
}

/**
 * Fonte da aba Agrupados: lê 1 doc-resumo por grupo (transaction_groups) +
 * avulsos paginados, independente do filtro de data. Membros são buscados
 * on-demand ao expandir, com cache em Map em memória — NUNCA cookie ou
 * localStorage (cookie viaja em toda request e tem ~4KB).
 *
 * Consistência eventual: os resumos são mantidos pelo trigger
 * onTransactionTotals (~segundos). Após mutação, o chamador usa refresh()
 * (com pequeno delay) — ver useFinancialData/página.
 */
export function useGroupedTransactions({
  tenantId,
  enabled,
  pageSize = PAGE_SIZE,
}: UseGroupedTransactionsOptions): UseGroupedTransactionsResult {
  const [groupSummaries, setGroupSummaries] = React.useState<
    TransactionGroupSummary[]
  >([]);
  const [standalone, setStandalone] = React.useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [membersVersion, setMembersVersion] = React.useState(0);

  const groupsCursorRef = React.useRef<QueryDocumentSnapshot | null>(null);
  const standaloneCursorRef = React.useRef<QueryDocumentSnapshot | null>(null);
  const [hasMoreGroups, setHasMoreGroups] = React.useState(false);
  const [hasMoreStandalone, setHasMoreStandalone] = React.useState(false);

  const membersCacheRef = React.useRef(new Map<string, Transaction[]>());
  const membersInFlightRef = React.useRef(
    new Map<string, Promise<Transaction[]>>(),
  );

  // Identidade do fetch corrente — descarta respostas obsoletas (troca de
  // tenant ou refresh concorrente).
  const fetchEpochRef = React.useRef(0);

  // Contagens carregadas via ref — fetchFirstPages fica estável (não é
  // recriado a cada mudança de length, evitando invalidação de memos).
  const loadedCountsRef = React.useRef({ groups: 0, standalone: 0 });
  loadedCountsRef.current = {
    groups: groupSummaries.length,
    standalone: standalone.length,
  };

  const fetchFirstPages = React.useCallback(
    async (opts?: { keepLoadedCount?: boolean }) => {
      if (!tenantId) return;
      const epoch = ++fetchEpochRef.current;

      const loadedCount = Math.max(
        pageSize,
        opts?.keepLoadedCount
          ? Math.max(
              loadedCountsRef.current.groups,
              loadedCountsRef.current.standalone,
            )
          : 0,
      );

      const [groupsPage, standalonePage] = await Promise.all([
        TransactionService.getGroupSummariesPaginated(tenantId, {
          pageSize: loadedCount,
        }),
        TransactionService.getStandaloneTransactionsPaginated(tenantId, {
          pageSize: loadedCount,
        }),
      ]);

      if (epoch !== fetchEpochRef.current) return;

      setGroupSummaries(groupsPage.groups);
      setStandalone(standalonePage.transactions);
      groupsCursorRef.current = groupsPage.nextCursor;
      standaloneCursorRef.current = standalonePage.nextCursor;
      setHasMoreGroups(groupsPage.nextCursor !== null);
      setHasMoreStandalone(standalonePage.nextCursor !== null);
    },
    [tenantId, pageSize],
  );
  const fetchFirstPagesRef = React.useRef(fetchFirstPages);
  fetchFirstPagesRef.current = fetchFirstPages;

  React.useEffect(() => {
    if (!enabled || !tenantId) return;
    let cancelled = false;
    setIsLoading(true);
    fetchFirstPagesRef
      .current()
      .catch((error) => {
        console.error("Failed to fetch grouped transactions", error);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, tenantId]);

  const loadMore = React.useCallback(async () => {
    if (!tenantId || isLoadingMore) return;
    if (!hasMoreGroups && !hasMoreStandalone) return;
    setIsLoadingMore(true);
    const epoch = fetchEpochRef.current;
    try {
      const [groupsPage, standalonePage] = await Promise.all([
        hasMoreGroups
          ? TransactionService.getGroupSummariesPaginated(tenantId, {
              pageSize,
              cursor: groupsCursorRef.current,
            })
          : null,
        hasMoreStandalone
          ? TransactionService.getStandaloneTransactionsPaginated(tenantId, {
              pageSize,
              cursor: standaloneCursorRef.current,
            })
          : null,
      ]);

      if (epoch !== fetchEpochRef.current) return;

      if (groupsPage) {
        setGroupSummaries((prev) => {
          const seen = new Set(prev.map((g) => g.id));
          return [...prev, ...groupsPage.groups.filter((g) => !seen.has(g.id))];
        });
        groupsCursorRef.current = groupsPage.nextCursor;
        setHasMoreGroups(groupsPage.nextCursor !== null);
      }
      if (standalonePage) {
        setStandalone((prev) => {
          const seen = new Set(prev.map((t) => t.id));
          return [
            ...prev,
            ...standalonePage.transactions.filter((t) => !seen.has(t.id)),
          ];
        });
        standaloneCursorRef.current = standalonePage.nextCursor;
        setHasMoreStandalone(standalonePage.nextCursor !== null);
      }
    } catch (error) {
      console.error("Failed to load more grouped transactions", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [tenantId, pageSize, isLoadingMore, hasMoreGroups, hasMoreStandalone]);

  const ensureMembers = React.useCallback(
    async (groupKey: string): Promise<Transaction[]> => {
      if (!tenantId) return [];
      const cached = membersCacheRef.current.get(groupKey);
      if (cached) return cached;
      const inFlight = membersInFlightRef.current.get(groupKey);
      if (inFlight) return inFlight;

      const promise = TransactionService.getGroupMembers(tenantId, groupKey)
        .then((members) => {
          membersCacheRef.current.set(groupKey, members);
          setMembersVersion((v) => v + 1);
          return members;
        })
        .finally(() => {
          membersInFlightRef.current.delete(groupKey);
        });
      membersInFlightRef.current.set(groupKey, promise);
      return promise;
    },
    [tenantId],
  );

  const getCachedMembers = React.useCallback(
    (groupKey: string) => membersCacheRef.current.get(groupKey),
    [],
  );

  const getAllCachedMembers = React.useCallback(() => {
    const all: Transaction[] = [];
    for (const members of membersCacheRef.current.values()) {
      all.push(...members);
    }
    return all;
  }, []);

  const refresh = React.useCallback(async () => {
    // Não limpa membersInFlightRef: ensureMembers concorrente reutiliza a
    // promise em voo; a revalidação abaixo sobrescreve o cache no fim.
    const cachedKeys = Array.from(membersCacheRef.current.keys());
    try {
      await Promise.all([
        fetchFirstPagesRef.current({ keepLoadedCount: true }),
        ...(tenantId
          ? cachedKeys.map(async (groupKey) => {
              const members = await TransactionService.getGroupMembers(
                tenantId,
                groupKey,
              );
              membersCacheRef.current.set(groupKey, members);
            })
          : []),
      ]);
      setMembersVersion((v) => v + 1);
    } catch (error) {
      console.error("Failed to refresh grouped transactions", error);
    }
  }, [tenantId]);

  return {
    groupSummaries,
    standalone,
    isLoading,
    isLoadingMore,
    hasMore: hasMoreGroups || hasMoreStandalone,
    loadMore,
    ensureMembers,
    getCachedMembers,
    getAllCachedMembers,
    membersVersion,
    refresh,
  };
}
