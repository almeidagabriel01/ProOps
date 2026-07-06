"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Wallet as WalletIcon } from "lucide-react";
import type {
  Transaction,
  TransactionGroupSummary,
  TransactionStatus,
  TransactionType,
} from "@/services/transaction-service";
import type { Wallet } from "@/types";
import { normalize } from "@/utils/text";
import { TransactionCard } from "./transaction-card";
import { getDateString } from "../_lib/financial-utils";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";

/**
 * Aba Agrupados (fonte nova, 2026-07-06): renderiza 1 card por doc-resumo de
 * transaction_groups + avulsos paginados. Membros são carregados on-demand ao
 * expandir (ensureMembers, cache no hook useGroupedTransactions). Enquanto os
 * membros não carregam, o card usa um representative sintético derivado do
 * resumo — com o id do membro âncora, então links/ações funcionam.
 */

export function summaryToRepresentative(
  summary: TransactionGroupSummary,
): Transaction {
  const groupId = summary.groupKey.split(":")[1] || summary.groupKey;
  return {
    id: summary.anchorTransactionId ?? summary.id,
    tenantId: summary.tenantId,
    type: summary.type,
    description: summary.description,
    // Recorrentes exibem o valor por ocorrência (âncora); demais, o total.
    amount:
      summary.kind === "recurring"
        ? (summary.anchorAmount ?? summary.total)
        : summary.total,
    date: summary.firstDueDate ?? summary.updatedAt.slice(0, 10),
    dueDate: summary.nextDueDate ?? summary.lastDueDate ?? undefined,
    status: summary.status,
    clientName: summary.clientName,
    proposalId: summary.proposalId,
    wallet: summary.wallet,
    isInstallment: summary.kind === "installment" ? true : undefined,
    isRecurring: summary.kind === "recurring" ? true : undefined,
    // Colapsado, o card mostra `{installmentNumber}/{installmentCount}x` —
    // preenchidos como pagas/total, mesma semântica dos statusCounts.
    installmentCount: summary.memberCount,
    installmentNumber: summary.paidCount,
    proposalGroupId: summary.kind === "proposal" ? groupId : undefined,
    installmentGroupId:
      summary.kind === "installment"
        ? groupId
        : summary.anchorInstallmentGroupId,
    recurringGroupId: summary.kind === "recurring" ? groupId : undefined,
    createdAt: summary.updatedAt,
    updatedAt: summary.updatedAt,
  } as Transaction;
}

interface GroupedViewFilters {
  searchTerm: string;
  filterType: TransactionType | "all";
  filterStatus: TransactionStatus[];
  filterWallet: string;
  filterStartDate: string;
  filterEndDate: string;
  filterDateType: "date" | "dueDate";
}

function walletMatches(
  walletField: string | undefined,
  filterWallet: string,
  wallets: Wallet[],
): boolean {
  if (!walletField) return false;
  if (walletField === filterWallet) return true;
  const filterWalletObj = wallets.find(
    (w) => w.id === filterWallet || w.name === filterWallet,
  );
  return (
    !!filterWalletObj &&
    (walletField === filterWalletObj.id || walletField === filterWalletObj.name)
  );
}

export function filterGroupSummaries(
  summaries: TransactionGroupSummary[],
  filters: GroupedViewFilters,
  wallets: Wallet[],
): TransactionGroupSummary[] {
  const term = filters.searchTerm.trim() ? normalize(filters.searchTerm) : "";
  return summaries.filter((s) => {
    if (filters.filterType !== "all" && s.type !== filters.filterType)
      return false;
    if (
      filters.filterStatus.length > 0 &&
      !filters.filterStatus.includes(s.status)
    )
      return false;
    if (
      filters.filterWallet &&
      !walletMatches(s.wallet, filters.filterWallet, wallets)
    )
      return false;
    if (filters.filterStartDate || filters.filterEndDate) {
      // Grupo casa o período se o intervalo [firstDueDate, lastDueDate]
      // intersecta o range do filtro.
      const first = s.firstDueDate ?? s.lastDueDate;
      const last = s.lastDueDate ?? s.firstDueDate;
      if (!first || !last) return false;
      if (filters.filterEndDate && first > filters.filterEndDate) return false;
      if (filters.filterStartDate && last < filters.filterStartDate)
        return false;
    }
    if (term) {
      const matches =
        normalize(s.description || "").includes(term) ||
        normalize(s.clientName || "").includes(term);
      if (!matches) return false;
    }
    return true;
  });
}

export function filterStandaloneTransactions(
  transactions: Transaction[],
  filters: GroupedViewFilters,
  wallets: Wallet[],
): Transaction[] {
  const term = filters.searchTerm.trim() ? normalize(filters.searchTerm) : "";
  return transactions.filter((t) => {
    if (filters.filterType !== "all" && t.type !== filters.filterType)
      return false;
    if (filters.filterStatus.length > 0) {
      const selfMatches = filters.filterStatus.includes(t.status);
      const extraMatches = (t.extraCosts || []).some((ec) =>
        filters.filterStatus.includes(
          (ec.status || "pending") as TransactionStatus,
        ),
      );
      if (!selfMatches && !extraMatches) return false;
    }
    if (filters.filterWallet) {
      const selfMatches = walletMatches(
        t.wallet,
        filters.filterWallet,
        wallets,
      );
      const extraMatches = (t.extraCosts || []).some((ec) =>
        walletMatches(ec.wallet || t.wallet, filters.filterWallet, wallets),
      );
      if (!selfMatches && !extraMatches) return false;
    }
    if (filters.filterStartDate || filters.filterEndDate) {
      const dateVal =
        filters.filterDateType === "dueDate" ? t.dueDate : t.date;
      const dateStr = getDateString(dateVal);
      if (!dateStr) return false;
      if (filters.filterStartDate && dateStr < filters.filterStartDate)
        return false;
      if (filters.filterEndDate && dateStr > filters.filterEndDate)
        return false;
    }
    if (term) {
      const matches =
        normalize(t.description || "").includes(term) ||
        normalize(t.clientName || "").includes(term) ||
        normalize(t.category || "").includes(term) ||
        normalize(t.wallet || "").includes(term) ||
        (t.extraCosts || []).some((ec) =>
          normalize(ec.description || "").includes(term),
        );
      if (!matches) return false;
    }
    return true;
  });
}

type GroupedItem =
  | { kind: "group"; sortKey: string; summary: TransactionGroupSummary }
  | { kind: "standalone"; sortKey: string; transaction: Transaction };

interface GroupedTransactionsViewProps {
  groupSummaries: TransactionGroupSummary[];
  standalone: Transaction[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  ensureMembers: (groupKey: string) => Promise<Transaction[]>;
  getCachedMembers: (groupKey: string) => Transaction[] | undefined;
  membersVersion: number;
  filters: GroupedViewFilters;
  wallets: Wallet[];
  canEdit: boolean;
  canDelete: boolean;
  onDelete: (t: Transaction) => void;
  onStatusChange: Parameters<typeof TransactionCard>[0]["onStatusChange"];
  onUpdateExtraCostStatus: Parameters<
    typeof TransactionCard
  >[0]["onUpdateExtraCostStatus"];
  onUpdate: Parameters<typeof TransactionCard>[0]["onUpdate"];
  onUpdateBatch: Parameters<typeof TransactionCard>[0]["onUpdateBatch"];
  onRegisterPartialPayment: Parameters<
    typeof TransactionCard
  >[0]["onRegisterPartialPayment"];
  onReload: () => Promise<void>;
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  /** Seleção de grupo com a lista real de membros (carrega on-demand). */
  onToggleGroupSelectionWithMembers: (
    representative: Transaction,
    members: Transaction[],
  ) => void;
  expandedIds: Set<string>;
  toggleExpand: (key: string, isOpen: boolean) => void;
}

export function GroupedTransactionsView({
  groupSummaries,
  standalone,
  isLoading,
  isLoadingMore,
  hasMore,
  loadMore,
  ensureMembers,
  getCachedMembers,
  membersVersion,
  filters,
  wallets,
  canEdit,
  canDelete,
  onDelete,
  onStatusChange,
  onUpdateExtraCostStatus,
  onUpdate,
  onUpdateBatch,
  onRegisterPartialPayment,
  onReload,
  selectedIds,
  onToggleSelection,
  onToggleGroupSelectionWithMembers,
  expandedIds,
  toggleExpand,
}: GroupedTransactionsViewProps) {
  const items = React.useMemo<GroupedItem[]>(() => {
    const filteredGroups = filterGroupSummaries(groupSummaries, filters, wallets);
    const filteredStandalone = filterStandaloneTransactions(
      standalone,
      filters,
      wallets,
    );
    const merged: GroupedItem[] = [
      ...filteredGroups.map((summary) => ({
        kind: "group" as const,
        sortKey: summary.lastDueDate ?? summary.firstDueDate ?? "",
        summary,
      })),
      ...filteredStandalone.map((transaction) => ({
        kind: "standalone" as const,
        sortKey: getDateString(transaction.dueDate || transaction.date) || "",
        transaction,
      })),
    ];
    return merged.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }, [groupSummaries, standalone, filters, wallets]);

  const { displayedItems, hasMore: hasMoreLocal, sentinelRef } =
    useInfiniteScroll(items, 6);

  // Sentinela local esgotada + servidor tem mais → busca próxima página.
  const showLoadMore = !hasMoreLocal && hasMore;

  const expansionKeyFor = (summary: TransactionGroupSummary) =>
    summary.kind === "proposal"
      ? `proposal-${summary.groupKey.split(":")[1]}`
      : `installment-${summary.groupKey.split(":")[1]}`;

  // Grupo expandido sem membros no cache (ex: primeira expansão via URL ou
  // cache descartado) → busca automaticamente.
  React.useEffect(() => {
    for (const s of groupSummaries) {
      const key =
        s.kind === "proposal"
          ? `proposal-${s.groupKey.split(":")[1]}`
          : `installment-${s.groupKey.split(":")[1]}`;
      if (expandedIds.has(key) && !getCachedMembers(s.groupKey)) {
        void ensureMembers(s.groupKey);
      }
    }
  }, [
    groupSummaries,
    expandedIds,
    membersVersion,
    getCachedMembers,
    ensureMembers,
  ]);

  if (isLoading) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="w-10 h-10" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="text-right space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16 ml-auto" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (groupSummaries.length === 0 && standalone.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <WalletIcon className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">
            Nenhum lançamento encontrado
          </h3>
          <p className="text-muted-foreground text-center max-w-md">
            Comece a registrar suas receitas e despesas.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Search className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            Nenhum resultado encontrado
          </h3>
          <p className="text-muted-foreground text-center">
            Tente buscar por outro termo ou remova os filtros.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3 flex-1">
      {displayedItems.map((item) => {
        if (item.kind === "standalone") {
          const transaction = item.transaction;
          return (
            <TransactionCard
              key={`standalone-${transaction.id}`}
              transaction={transaction}
              relatedInstallments={[]}
              proposalGroupTransactions={[]}
              canEdit={canEdit}
              canDelete={canDelete}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
              onUpdateExtraCostStatus={onUpdateExtraCostStatus}
              onUpdate={onUpdate}
              onUpdateBatch={onUpdateBatch}
              onRegisterPartialPayment={onRegisterPartialPayment}
              isSelected={selectedIds.has(transaction.id)}
              onToggleSelection={onToggleSelection}
              onToggleGroupSelection={(t) =>
                onToggleGroupSelectionWithMembers(t, [t])
              }
              selectedIds={selectedIds}
              isExpanded={expandedIds.has(`transaction-${transaction.id}`)}
              onToggleExpand={(isOpen) =>
                toggleExpand(`transaction-${transaction.id}`, isOpen)
              }
              onReload={onReload}
              wallets={wallets}
            />
          );
        }

        const summary = item.summary;
        const members = getCachedMembers(summary.groupKey);
        const representative = summaryToRepresentative(summary);
        const expansionKey = expansionKeyFor(summary);
        const isProposal = summary.kind === "proposal";

        return (
          <TransactionCard
            key={`group-${summary.id}`}
            transaction={representative}
            relatedInstallments={!isProposal && members ? members : []}
            proposalGroupTransactions={isProposal && members ? members : []}
            forceExpandable
            canEdit={canEdit}
            canDelete={canDelete}
            onDelete={onDelete}
            onStatusChange={onStatusChange}
            onUpdateExtraCostStatus={onUpdateExtraCostStatus}
            onUpdate={onUpdate}
            onUpdateBatch={onUpdateBatch}
            onRegisterPartialPayment={onRegisterPartialPayment}
            isSelected={selectedIds.has(representative.id)}
            onToggleSelection={onToggleSelection}
            onToggleGroupSelection={(t) => {
              const cached = getCachedMembers(summary.groupKey);
              if (cached) {
                onToggleGroupSelectionWithMembers(t, cached);
              } else {
                void ensureMembers(summary.groupKey).then((loaded) =>
                  onToggleGroupSelectionWithMembers(t, loaded),
                );
              }
            }}
            selectedIds={selectedIds}
            isExpanded={expandedIds.has(expansionKey)}
            onToggleExpand={(isOpen) => {
              toggleExpand(expansionKey, isOpen);
              if (isOpen && !getCachedMembers(summary.groupKey)) {
                void ensureMembers(summary.groupKey);
              }
            }}
            onReload={onReload}
            wallets={wallets}
          />
        );
      })}
      {hasMoreLocal && (
        <div ref={sentinelRef} className="flex items-center justify-center py-4">
          <Loader size="md" />
        </div>
      )}
      {showLoadMore && (
        <div className="flex items-center justify-center py-4">
          <Button
            variant="outline"
            onClick={() => void loadMore()}
            disabled={isLoadingMore}
            className="gap-2"
          >
            {isLoadingMore ? <Loader size="sm" /> : null}
            Carregar mais
          </Button>
        </div>
      )}
      {/* membersVersion nas deps de render: cache muda → re-render */}
      <span className="hidden" data-members-version={membersVersion} />
    </div>
  );
}
