"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UpgradeModal, useUpgradeModal } from "@/components/ui/upgrade-modal";
import { UpgradeRequired } from "@/components/ui/upgrade-required";
import { useThemePrimaryColor } from "@/hooks/useThemePrimaryColor";
import { usePagePermission } from "@/hooks/usePagePermission";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { Transaction } from "@/services/transaction-service";
import { Crown, Kanban, Plus, Search, Wallet, WalletCards, X } from "lucide-react";
import { formatCurrency } from "@/utils/format";
import { useFinancialData } from "./_hooks/useFinancialData";
import { useGroupedTransactions } from "./_hooks/useGroupedTransactions";
import {
  GroupedTransactionsView,
  filterGroupSummaries,
  filterStandaloneTransactions,
} from "./_components/grouped-transactions-view";
import { FinancialSkeleton } from "./_components/financial-skeleton";
import { useTenant } from "@/providers/tenant-provider";
import { useAuth } from "@/providers/auth-provider";
import {
  FinancialSummaryCards,
  DeleteTransactionDialog,
  TransactionFilters,
  TransactionListByDueDate,
} from "./_components";
import { Skeleton } from "@/components/ui/skeleton";
import { useSort } from "@/hooks/use-sort";
import { SelectTenantState } from "@/components/shared/select-tenant-state";

export default function FinancialPage() {
  const { tenant, isLoading: tenantLoading } = useTenant();
  const { user } = useAuth();
  const { canCreate, canEdit, canDelete } = usePagePermission("financial");
  const { hasKanban } = usePlanLimits();
  const upgradeModal = useUpgradeModal();
  const canAccessCrm = hasKanban || user?.role === "superadmin";
  const premiumColor = useThemePrimaryColor();
  const {
    summary,
    isLoading: dataLoading,
    hasFinancial,
    isPlanLoading,
    searchTerm,
    setSearchTerm,
    filterType,
    setFilterType,
    filterStatus,
    setFilterStatus,
    filterWallet,
    setFilterWallet,
    filterStartDate,
    setFilterStartDate,
    filterEndDate,
    setFilterEndDate,
    filterDateType,
    setFilterDateType,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
    filteredTransactions,
    totalWalletBalance,
    deleteTransactionGroup,
    updateGroupStatus,
    updateExtraCostStatus,
    updateTransaction,
    updateBatchTransactions,
    registerPartialPayment,
    transactions,
    refreshData,
    wallets,
  } = useFinancialData();

  // Fonte da aba Agrupados: resumos de transaction_groups + avulsos paginados,
  // membros lazy — independente do filtro de data (2026-07-06).
  const grouped = useGroupedTransactions({
    tenantId: tenant?.id,
    enabled: viewMode === "grouped" && hasFinancial,
  });
  const groupedRefreshTimerRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  // Resumos são mantidos por trigger (~segundos). Após mutação na aba
  // Agrupados, refetch com delay — decisão registrada no CLAUDE.md do módulo.
  const scheduleGroupedRefresh = React.useCallback(() => {
    if (groupedRefreshTimerRef.current) {
      clearTimeout(groupedRefreshTimerRef.current);
    }
    groupedRefreshTimerRef.current = setTimeout(() => {
      groupedRefreshTimerRef.current = null;
      void grouped.refresh();
    }, 1500);
  }, [grouped]);
  React.useEffect(
    () => () => {
      if (groupedRefreshTimerRef.current) {
        clearTimeout(groupedRefreshTimerRef.current);
      }
    },
    [],
  );

  const withGroupedRefresh = React.useCallback(
    <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
      async (...args: A): Promise<R> => {
        const result = await fn(...args);
        if (viewMode === "grouped") scheduleGroupedRefresh();
        return result;
      },
    [viewMode, scheduleGroupedRefresh],
  );

  const groupedUpdateGroupStatus = React.useMemo(
    () => withGroupedRefresh(updateGroupStatus),
    [withGroupedRefresh, updateGroupStatus],
  );
  const groupedUpdateExtraCostStatus = React.useMemo(
    () => withGroupedRefresh(updateExtraCostStatus),
    [withGroupedRefresh, updateExtraCostStatus],
  );
  const groupedUpdateTransaction = React.useMemo(
    () => withGroupedRefresh(updateTransaction),
    [withGroupedRefresh, updateTransaction],
  );
  const groupedUpdateBatchTransactions = React.useMemo(
    () => withGroupedRefresh(updateBatchTransactions),
    [withGroupedRefresh, updateBatchTransactions],
  );
  const groupedRegisterPartialPayment = React.useMemo(
    () => withGroupedRefresh(registerPartialPayment),
    [withGroupedRefresh, registerPartialPayment],
  );

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [transactionToDelete, setTransactionToDelete] =
    React.useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Selection state
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

  // Sorting state for byDueDate view
  const {
    items: sortedTransactions,
    requestSort,
    sortConfig,
  } = useSort(filteredTransactions);

  // Active filters detection and management
  const hasActiveFilters = React.useMemo(() => {
    return (
      searchTerm.trim() !== "" ||
      filterType !== "all" ||
      filterWallet !== "" ||
      filterStartDate !== "" ||
      filterEndDate !== "" ||
      filterStatus.length > 0
    );
  }, [
    searchTerm,
    filterType,
    filterWallet,
    filterStartDate,
    filterEndDate,
    filterStatus,
  ]);

  const handleClearFilters = React.useCallback(() => {
    setSearchTerm("");
    setFilterType("all");
    setFilterWallet("");
    setFilterStartDate("");
    setFilterEndDate("");
    setFilterStatus([]);
  }, [
    setSearchTerm,
    setFilterType,
    setFilterWallet,
    setFilterStartDate,
    setFilterEndDate,
    setFilterStatus,
  ]);

  // Toggle expand for a transaction using stable key
  const toggleExpand = React.useCallback((key: string, isOpen: boolean) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (isOpen) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }, []);

  // Toggle selection for a single transaction (used for individual installments)
  const toggleSelection = React.useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Seleção de grupo na aba Agrupados: recebe a lista REAL de membros
  // (carregada on-demand pelo useGroupedTransactions) — não depende do
  // escopo por período de `transactions`.
  const toggleGroupSelectionWithMembers = React.useCallback(
    (representative: Transaction, members: Transaction[]) => {
      const pool = members.length > 0 ? members : [representative];
      const relatedIds: string[] = [];
      pool.forEach((t) => {
        relatedIds.push(t.id);
        t.extraCosts?.forEach((ec) => relatedIds.push(ec.id));
      });
      if (!relatedIds.includes(representative.id)) {
        relatedIds.push(representative.id);
      }

      setSelectedIds((prev) => {
        const next = new Set(prev);
        const allSelected = relatedIds.every((id) => next.has(id));
        if (allSelected) {
          relatedIds.forEach((id) => next.delete(id));
        } else {
          relatedIds.forEach((id) => next.add(id));
        }
        return next;
      });
    },
    [],
  );

  // Toggle select all for filtered transactions
  const toggleSelectAll = React.useCallback(() => {
    const allIds = filteredTransactions.map((t) => t.id);
    const allSelected = allIds.every((id) => selectedIds.has(id));

    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  }, [filteredTransactions, selectedIds]);

  const prevViewMode = React.useRef(viewMode);
  const prevFilterKey = React.useRef("");
  const hasInitializedSelection = React.useRef(false);

  // Handle selection when view mode or filters change
  React.useEffect(() => {
    const currentFilterKey = `${filterType}-${filterStatus.join(",")}-${filterWallet}-${filterStartDate}-${filterEndDate}-${searchTerm}`;
    const modeChanged = viewMode !== prevViewMode.current;
    const filtersChanged = currentFilterKey !== prevFilterKey.current;

    prevViewMode.current = viewMode;
    prevFilterKey.current = currentFilterKey;

    // Wait until data finishes loading to do the initial selection
    if (!dataLoading && !hasInitializedSelection.current) {
      if (filteredTransactions.length > 0) {
        hasInitializedSelection.current = true;
        if (viewMode === "byDueDate") {
          const allIds = filteredTransactions.map((t) => t.id);
          setSelectedIds(new Set(allIds));
        }
      } else if (transactions.length === 0) {
        // If there really are no transactions after loading, mark as initialized anyway
        hasInitializedSelection.current = true;
      }
      return;
    }

    if (modeChanged) {
      if (viewMode === "grouped") {
        setSelectedIds(new Set()); // Grouped starts empty
      } else if (viewMode === "byDueDate") {
        const allIds = filteredTransactions.map((t) => t.id);
        setSelectedIds(new Set(allIds)); // ByDueDate starts with all selected
      }
    } else if (viewMode === "byDueDate" && filtersChanged) {
      // Re-select all if user actually changed filters
      const allIds = filteredTransactions.map((t) => t.id);
      setSelectedIds(new Set(allIds));
    }
  }, [
    dataLoading,
    transactions.length,
    viewMode,
    filterType,
    filterStatus,
    filterWallet,
    filterStartDate,
    filterEndDate,
    searchTerm,
    filteredTransactions,
  ]);

  // Pool de somatório da seleção: na aba Agrupados inclui avulsos e membros
  // já carregados (fora do escopo por período de `transactions`).
  const selectionPool = React.useMemo(() => {
    if (viewMode !== "grouped") return transactions;
    const byId = new Map<string, Transaction>();
    for (const t of [
      ...grouped.standalone,
      ...grouped.getAllCachedMembers(),
      ...transactions,
    ]) {
      if (!byId.has(t.id)) byId.set(t.id, t);
    }
    return Array.from(byId.values());
    // membersVersion: cache de membros mudou → recomputa o pool
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    viewMode,
    transactions,
    grouped.standalone,
    grouped.getAllCachedMembers,
    grouped.membersVersion,
  ]);

  // Calculate selection summary - use ALL transactions, not just filtered
  const selectionSummary = React.useMemo(() => {
    if (selectedIds.size === 0) return undefined;

    const result = {
      count: 0,
      paidIncome: 0,
      paidExpense: 0,
      pendingIncome: 0,
      pendingExpense: 0,
    };

    selectionPool.forEach((t) => {
      // Main
      if (selectedIds.has(t.id)) {
        result.count++;
        if (t.type === "income") {
          if (t.status === "paid") result.paidIncome += t.amount;
          else result.pendingIncome += t.amount;
        } else {
          if (t.status === "paid") result.paidExpense += t.amount;
          else result.pendingExpense += t.amount;
        }
      }

      // Extra Costs
      if (t.extraCosts && t.extraCosts.length > 0) {
        t.extraCosts.forEach((ec) => {
          if (selectedIds.has(ec.id)) {
            result.count++;
            if (t.type === "income") {
              if (ec.status === "paid") result.paidIncome += ec.amount;
              else result.pendingIncome += ec.amount;
            } else {
              if (ec.status === "paid") result.paidExpense += ec.amount;
              else result.pendingExpense += ec.amount;
            }
          }
        });
      }
    });

    return result;
  }, [selectedIds, selectionPool]);

  // Cards de resumo da aba Agrupados: derivados de paidTotal/pendingTotal dos
  // resumos carregados + avulsos carregados (com filtros aplicados) — refletem
  // o que está carregado, mesma semântica do "com filtros ativos".
  const groupedSummary = React.useMemo(() => {
    if (viewMode !== "grouped") return null;
    const filters = {
      searchTerm,
      filterType,
      filterStatus,
      filterWallet,
      filterStartDate,
      filterEndDate,
      filterDateType,
    };
    const result = {
      totalIncome: 0,
      totalExpense: 0,
      pendingIncome: 0,
      pendingExpense: 0,
    };
    filterGroupSummaries(grouped.groupSummaries, filters, wallets).forEach(
      (s) => {
        if (s.type === "income") {
          result.totalIncome += s.paidTotal;
          result.pendingIncome += s.pendingTotal;
        } else {
          result.totalExpense += s.paidTotal;
          result.pendingExpense += s.pendingTotal;
        }
      },
    );
    filterStandaloneTransactions(grouped.standalone, filters, wallets).forEach(
      (t) => {
        const add = (amount: number, paid: boolean) => {
          if (t.type === "income") {
            if (paid) result.totalIncome += amount;
            else result.pendingIncome += amount;
          } else {
            if (paid) result.totalExpense += amount;
            else result.pendingExpense += amount;
          }
        };
        add(t.amount, t.status === "paid");
        t.extraCosts?.forEach((ec) =>
          add(ec.amount, (ec.status || "pending") === "paid"),
        );
      },
    );
    return result;
  }, [
    viewMode,
    grouped.groupSummaries,
    grouped.standalone,
    searchTerm,
    filterType,
    filterStatus,
    filterWallet,
    filterStartDate,
    filterEndDate,
    filterDateType,
    wallets,
  ]);

  // Use total wallet balance, ignoring selection to keep general balance stable
  const balance = totalWalletBalance;

  // Show loading first - before checking plan access to avoid flash
  // Show loading first - before checking plan access to avoid flash
  if (tenantLoading || isPlanLoading) {
    return <FinancialSkeleton />;
  }

  if (!tenant && user?.role === "superadmin") {
    return <SelectTenantState />;
  }

  // Check plan access after loading is complete
  if (!hasFinancial) {
    return (
      <UpgradeRequired
        feature="Financeiro"
        description="O módulo Financeiro permite gerenciar suas receitas, despesas e fluxo de caixa. Faça upgrade para o plano Profissional ou Enterprise para acessar."
      />
    );
  }

  const openDeleteDialog = (transaction: Transaction) => {
    setTransactionToDelete(transaction);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!transactionToDelete) return;

    setIsDeleting(true);
    await deleteTransactionGroup(transactionToDelete);
    if (viewMode === "grouped") scheduleGroupedRefresh();
    setIsDeleting(false);
    setDeleteDialogOpen(false);
    setTransactionToDelete(null);
  };

  const handleViewModeChange = (mode: "grouped" | "byDueDate") => {
    setViewMode(mode);
    if (mode === "byDueDate") {
      setFilterDateType("dueDate");
    }
  };

  return (
    <div className="space-y-6 flex flex-col min-h-[calc(100vh-180px)]">
      {/* Header with Balance */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lançamentos</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie receitas e despesas
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
            {canAccessCrm ? (
              <Button asChild variant="outline" size="lg" className="gap-2">
                <Link href="/crm?scope=transactions">
                  <Kanban className="w-5 h-5" />
                  CRM de Lançamentos
                </Link>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="lg"
                className="relative gap-2 pr-10"
                onClick={() =>
                  upgradeModal.showUpgradeModal(
                    "CRM",
                    "O módulo CRM pode ser contratado como add-on ou vem incluído no plano Enterprise.",
                    "enterprise",
                  )
                }
              >
                <Kanban className="w-5 h-5" />
                CRM de Lançamentos
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-background ring-1 ring-border/70">
                  <Crown className="h-3 w-3" style={{ color: premiumColor }} />
                </span>
              </Button>
            )}

            <Button asChild variant="outline" size="lg" className="gap-2">
              <Link href="/wallets">
                <WalletCards className="w-5 h-5" />
                Carteiras
              </Link>
            </Button>

            {canCreate && (
              <Button asChild size="lg" className="gap-2">
                <Link href="/transactions/new">
                  <Plus className="w-5 h-5" />
                  Novo Lançamento
                </Link>
              </Button>
            )}
          </div>

          <div className="text-center sm:text-right">
            <div className="flex items-center gap-2 text-muted-foreground mb-1 justify-center sm:justify-end">
              <Wallet className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wide">
                Saldo
              </span>
            </div>
            <div
              className={`text-2xl font-bold ${balance >= 0 ? "text-green-500" : "text-red-500"}`}
            >
              {formatCurrency(balance)}
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards - with centered minimalist indicators */}
      <div className="space-y-3">
        {hasActiveFilters ? (
          <div className="flex justify-center mb-4 mt-2">
            <div className="inline-flex items-center gap-3 px-3 py-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-900 dark:text-amber-200 text-xs animate-in fade-in slide-in-from-top-1 duration-200 shadow-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                <span>
                  Resumo com <strong className="font-semibold text-amber-600 dark:text-amber-400">filtros ativos</strong> aplicados
                </span>
              </div>
              <button
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition-colors cursor-pointer text-xs border-l border-amber-500/20 pl-3 py-0.5"
              >
                <X className="w-3.5 h-3.5" />
                Limpar Filtros
              </button>
            </div>
          </div>
        ) : selectedIds.size > 0 ? (
          <div className="flex justify-center mb-4 mt-2">
            <div className="inline-flex items-center gap-3 px-3 py-1.5 rounded-lg border border-blue-500/20 bg-blue-500/5 text-blue-900 dark:text-blue-200 text-xs animate-in fade-in slide-in-from-top-1 duration-200 shadow-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
                <span>
                  Resumo baseado em <strong className="font-semibold text-blue-600 dark:text-blue-400">{selectedIds.size}</strong> lançamento{selectedIds.size !== 1 ? "s" : ""} selecionado{selectedIds.size !== 1 ? "s" : ""}
                </span>
              </div>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors cursor-pointer text-xs border-l border-blue-500/20 pl-3 py-0.5"
              >
                <X className="w-3.5 h-3.5" />
                Limpar Seleção
              </button>
            </div>
          </div>
        ) : null}
        <FinancialSummaryCards
          summary={viewMode === "grouped" && groupedSummary ? groupedSummary : summary}
          selectionSummary={selectionSummary}
          balance={balance}
        />
      </div>

      {/* Filters */}
      <TransactionFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filterType={filterType}
        onFilterChange={setFilterType}
        filterStatus={filterStatus}
        onStatusChange={setFilterStatus}
        filterWallet={filterWallet}
        onWalletChange={setFilterWallet}
        filterStartDate={filterStartDate}
        onStartDateChange={setFilterStartDate}
        filterEndDate={filterEndDate}
        onEndDateChange={setFilterEndDate}
        filterDateType={filterDateType}
        onDateTypeChange={setFilterDateType}
        sortBy={sortBy}
        onSortChange={setSortBy}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
      />

      {/* Transactions List */}
      {viewMode === "grouped" ? (
        <GroupedTransactionsView
          groupSummaries={grouped.groupSummaries}
          standalone={grouped.standalone}
          isLoading={grouped.isLoading}
          isLoadingMore={grouped.isLoadingMore}
          hasMore={grouped.hasMore}
          loadMore={grouped.loadMore}
          ensureMembers={grouped.ensureMembers}
          getCachedMembers={grouped.getCachedMembers}
          membersVersion={grouped.membersVersion}
          filters={{
            searchTerm,
            filterType,
            filterStatus,
            filterWallet,
            filterStartDate,
            filterEndDate,
            filterDateType,
          }}
          wallets={wallets}
          canEdit={canEdit}
          canDelete={canDelete}
          onDelete={openDeleteDialog}
          onStatusChange={groupedUpdateGroupStatus}
          onUpdateExtraCostStatus={groupedUpdateExtraCostStatus}
          onUpdate={groupedUpdateTransaction}
          onUpdateBatch={groupedUpdateBatchTransactions}
          onRegisterPartialPayment={groupedRegisterPartialPayment}
          onReload={async () => {
            await refreshData(true);
            await grouped.refresh();
          }}
          selectedIds={selectedIds}
          onToggleSelection={toggleSelection}
          onToggleGroupSelectionWithMembers={toggleGroupSelectionWithMembers}
          expandedIds={expandedIds}
          toggleExpand={toggleExpand}
        />
      ) : dataLoading ? (
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
      ) : transactions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Wallet className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              Nenhum lançamento encontrado
            </h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Comece a registrar suas receitas e despesas.
            </p>
            {canCreate && (
              <Link href="/transactions/new">
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Criar Primeiro Lançamento
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : filteredTransactions.length === 0 ? (
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
      ) : (
        // Lista (byDueDate): visão compacta, escopo por período — intocada.
        <TransactionListByDueDate
          transactions={sortedTransactions}
          allTransactions={transactions}
          canEdit={canEdit}
          canDelete={canDelete}
          onDelete={openDeleteDialog}
          onStatusChange={updateGroupStatus}
          onUpdateExtraCostStatus={updateExtraCostStatus}
          onUpdate={updateTransaction}
          selectedIds={selectedIds}
          onToggleSelection={toggleSelection}
          onToggleSelectAll={toggleSelectAll}
          onSort={requestSort}
          sortConfig={sortConfig}
          onRegisterPartialPayment={registerPartialPayment}
          onReload={() => refreshData(true)}
          wallets={wallets}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteTransactionDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        transaction={transactionToDelete}
        onConfirm={confirmDelete}
        isDeleting={isDeleting}
      />

      <UpgradeModal
        open={upgradeModal.isOpen}
        onOpenChange={upgradeModal.setIsOpen}
        feature={upgradeModal.feature}
        description={upgradeModal.description}
        requiredPlan={upgradeModal.requiredPlan}
      />
    </div>
  );
}
