"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UpgradeModal, useUpgradeModal } from "@/components/ui/upgrade-modal";
import { UpgradeRequired } from "@/components/ui/upgrade-required";
import { lightenColor } from "@/components/layout/navigation-config";
import { usePagePermission } from "@/hooks/usePagePermission";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { Transaction } from "@/services/transaction-service";
import {
  Crown,
  Kanban,
  Plus,
  Search,
  Wallet,
  WalletCards,
  X,
} from "lucide-react";
import type { Wallet as WalletType } from "@/types";
import { formatCurrency } from "@/utils/format";
import { useFinancialData } from "./_hooks/useFinancialData";
import { FinancialSkeleton } from "./_components/financial-skeleton";
import { useTenant } from "@/providers/tenant-provider";
import { useAuth } from "@/providers/auth-provider";
import {
  FinancialSummaryCards,
  TransactionCard,
  DeleteTransactionDialog,
  TransactionFilters,
  TransactionListByDueDate,
} from "./_components";
import { Skeleton } from "@/components/ui/skeleton";
import { useSort } from "@/hooks/use-sort";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { Loader2 } from "lucide-react";
import { SelectTenantState } from "@/components/shared/select-tenant-state";

const isDownPaymentLike = (t: Transaction): boolean =>
  !!t.isDownPayment || (t.installmentNumber || 0) === 0;

const dateOnly = (value?: string): string => {
  if (!value) return "";
  return value.includes("T") ? value.split("T")[0] : value;
};

const sameClient = (a: Transaction, b: Transaction): boolean => {
  const aClientId = a.clientId || "";
  const bClientId = b.clientId || "";
  if (aClientId && bClientId) return aClientId === bClientId;
  return (a.clientName || "").trim() === (b.clientName || "").trim();
};

const baseDesc = (s: string): string =>
  s.replace(/\s*\(\d+\/\d+\)\s*$/, "").trim();

/** Infinite scroll wrapper for grouped transaction cards */
function TransactionListInfinite({
  filteredTransactions,
  transactions,
  canEdit,
  canDelete,
  openDeleteDialog,
  updateGroupStatus,
  updateExtraCostStatus,
  updateTransaction,
  updateBatchTransactions,
  registerPartialPayment,
  selectedIds,
  toggleSelection,
  toggleGroupSelection,
  expandedIds,
  getExpansionKey,
  toggleExpand,
  refreshData,
  wallets,
}: {
  filteredTransactions: Transaction[];
  transactions: Transaction[];
  canEdit: boolean;
  canDelete: boolean;
  openDeleteDialog: (t: Transaction) => void;
  updateGroupStatus: Parameters<typeof TransactionCard>[0]["onStatusChange"];
  updateExtraCostStatus: Parameters<
    typeof TransactionCard
  >[0]["onUpdateExtraCostStatus"];
  updateTransaction: Parameters<typeof TransactionCard>[0]["onUpdate"];
  updateBatchTransactions: Parameters<
    typeof TransactionCard
  >[0]["onUpdateBatch"];
  registerPartialPayment: Parameters<
    typeof TransactionCard
  >[0]["onRegisterPartialPayment"];
  selectedIds: Set<string>;
  toggleSelection: (id: string) => void;
  toggleGroupSelection: (t: Transaction) => void;
  expandedIds: Set<string>;
  getExpansionKey: (t: Transaction) => string;
  toggleExpand: (key: string, isOpen: boolean) => void;
  refreshData: (bg?: boolean) => Promise<void>;
  wallets: WalletType[];
}) {
  const { displayedItems, hasMore, sentinelRef } = useInfiniteScroll(
    filteredTransactions,
    6,
  );

  return (
    <div className="flex flex-col gap-3 flex-1">
      {displayedItems.map((transaction) => {
        const groupId =
          transaction.proposalGroupId ||
          transaction.installmentGroupId ||
          transaction.recurringGroupId;

        if (groupId) {
          const groupMembers = transactions.filter(
            (t) =>
              t.proposalGroupId === groupId ||
              t.installmentGroupId === groupId ||
              t.recurringGroupId === groupId,
          );

          const orphanDownPayments = transactions.filter(
            (t) =>
              !t.installmentGroupId &&
              !t.recurringGroupId &&
              !t.proposalGroupId &&
              isDownPaymentLike(t) &&
              !transaction.proposalGroupId &&
              t.type === transaction.type &&
              baseDesc(t.description || "") ===
                baseDesc(transaction.description || "") &&
              sameClient(t, transaction) &&
              dateOnly(t.date) === dateOnly(transaction.date),
          );
          if (orphanDownPayments.length === 1) {
            groupMembers.push(orphanDownPayments[0]);
          }

          const uniqueGroupMembers = Array.from(
            new Map(groupMembers.map((member) => [member.id, member])).values(),
          );

          uniqueGroupMembers.sort((a, b) => {
            if (isDownPaymentLike(a) && !isDownPaymentLike(b)) return -1;
            if (!isDownPaymentLike(a) && isDownPaymentLike(b)) return 1;
            if ((a.installmentNumber || 0) !== (b.installmentNumber || 0)) {
              return (a.installmentNumber || 0) - (b.installmentNumber || 0);
            }
            return new Date(a.date).getTime() - new Date(b.date).getTime();
          });

          return (
            <TransactionCard
              key={`${getExpansionKey(transaction)}-${transaction.id}`}
              transaction={transaction}
              relatedInstallments={
                !transaction.proposalGroupId ? uniqueGroupMembers : []
              }
              proposalGroupTransactions={
                transaction.proposalGroupId ? uniqueGroupMembers : []
              }
              canEdit={canEdit}
              canDelete={canDelete}
              onDelete={openDeleteDialog}
              onStatusChange={updateGroupStatus}
              onUpdateExtraCostStatus={updateExtraCostStatus}
              onUpdate={updateTransaction}
              onUpdateBatch={updateBatchTransactions}
              onRegisterPartialPayment={registerPartialPayment}
              isSelected={selectedIds.has(transaction.id)}
              onToggleSelection={toggleSelection}
              onToggleGroupSelection={toggleGroupSelection}
              selectedIds={selectedIds}
              isExpanded={expandedIds.has(getExpansionKey(transaction))}
              onToggleExpand={(isOpen) =>
                toggleExpand(getExpansionKey(transaction), isOpen)
              }
              onReload={() => refreshData(true)}
              wallets={wallets}
            />
          );
        }

        return (
          <TransactionCard
            key={`${getExpansionKey(transaction)}-${transaction.id}`}
            transaction={transaction}
            relatedInstallments={[]}
            proposalGroupTransactions={[]}
            canEdit={canEdit}
            canDelete={canDelete}
            onDelete={openDeleteDialog}
            onStatusChange={updateGroupStatus}
            onUpdateExtraCostStatus={updateExtraCostStatus}
            onUpdate={updateTransaction}
            onUpdateBatch={updateBatchTransactions}
            onRegisterPartialPayment={registerPartialPayment}
            isSelected={selectedIds.has(transaction.id)}
            onToggleSelection={toggleSelection}
            onToggleGroupSelection={toggleGroupSelection}
            selectedIds={selectedIds}
            isExpanded={expandedIds.has(getExpansionKey(transaction))}
            onToggleExpand={(isOpen) =>
              toggleExpand(getExpansionKey(transaction), isOpen)
            }
            onReload={() => refreshData(true)}
            wallets={wallets}
          />
        );
      })}
      {hasMore && (
        <div
          ref={sentinelRef}
          className="flex items-center justify-center py-4"
        >
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

export default function FinancialPage() {
  const { tenant, isLoading: tenantLoading } = useTenant();
  const { user } = useAuth();
  const { canCreate, canEdit, canDelete } = usePagePermission("financial");
  const { hasKanban } = usePlanLimits();
  const upgradeModal = useUpgradeModal();
  const canAccessCrm = hasKanban || user?.role === "superadmin";
  const premiumColor = lightenColor(tenant?.primaryColor || "#2563eb", 25);
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

  // Helper to get stable ID for expansion
  const getExpansionKey = React.useCallback((t: Transaction) => {
    if (t.proposalGroupId) return `proposal-${t.proposalGroupId}`;
    if (t.installmentGroupId || t.recurringGroupId)
      return `installment-${t.installmentGroupId || t.recurringGroupId}`;
    return `transaction-${t.id}`;
  }, []);

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

  // Toggle selection for a transaction group (main card and all related installments)
  const toggleGroupSelection = React.useCallback(
    (transaction: Transaction) => {
      // Find all related transactions to this one
      const relatedIds: string[] = [transaction.id];
      if (transaction.extraCosts) {
        transaction.extraCosts.forEach((ec) => relatedIds.push(ec.id));
      }

      // Add proposal group members
      if (transaction.proposalGroupId) {
        transactions.forEach((t) => {
          if (
            t.proposalGroupId === transaction.proposalGroupId &&
            t.id !== transaction.id
          ) {
            relatedIds.push(t.id);
            if (t.extraCosts) {
              t.extraCosts.forEach((ec) => relatedIds.push(ec.id));
            }
          }
        });
      }
      // Add installment group members (for non-proposal groups)
      else if (
        (transaction.installmentGroupId || transaction.recurringGroupId) &&
        !transaction.proposalGroupId
      ) {
        transactions.forEach((t) => {
          if (
            (t.installmentGroupId || t.recurringGroupId) ===
              (transaction.installmentGroupId ||
                transaction.recurringGroupId) &&
            t.id !== transaction.id
          ) {
            relatedIds.push(t.id);
            if (t.extraCosts) {
              t.extraCosts.forEach((ec) => relatedIds.push(ec.id));
            }
          }
        });
      }

      setSelectedIds((prev) => {
        const next = new Set(prev);
        // If all are already selected, deselect all
        const allSelected = relatedIds.every((id) => next.has(id));

        if (allSelected) {
          relatedIds.forEach((id) => next.delete(id));
        } else {
          relatedIds.forEach((id) => next.add(id));
        }
        return next;
      });
    },
    [transactions],
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
    const currentFilterKey = `${filterType}-${filterStatus}-${filterWallet}-${filterStartDate}-${filterEndDate}-${searchTerm}`;
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

    transactions.forEach((t) => {
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
  }, [selectedIds, transactions]);

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
    setIsDeleting(false);
    setDeleteDialogOpen(false);
    setTransactionToDelete(null);
  };

  const handleViewModeChange = (mode: "grouped" | "byDueDate") => {
    setViewMode(mode);
    if (mode === "byDueDate") {
      setFilterDateType("dueDate");
      setFilterStatus("pending");
    } else {
      setFilterStatus("all");
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

      {/* Summary Cards - with selection indicator */}
      <div className="space-y-2">
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Mostrando valores de <strong>{selectedIds.size}</strong> item
              {selectedIds.size !== 1 ? "s" : ""} selecionado
              {selectedIds.size !== 1 ? "s" : ""}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs gap-1"
              onClick={() => setSelectedIds(new Set())}
            >
              <X className="w-3 h-3" />
              Limpar
            </Button>
          </div>
        )}
        <FinancialSummaryCards
          summary={summary}
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
      {dataLoading ? (
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
      ) : viewMode === "byDueDate" ? (
        // In byDueDate mode, use compact list view
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
      ) : (
        <TransactionListInfinite
          filteredTransactions={filteredTransactions}
          transactions={transactions}
          canEdit={canEdit}
          canDelete={canDelete}
          openDeleteDialog={openDeleteDialog}
          updateGroupStatus={updateGroupStatus}
          updateExtraCostStatus={updateExtraCostStatus}
          updateTransaction={updateTransaction}
          updateBatchTransactions={updateBatchTransactions}
          registerPartialPayment={registerPartialPayment}
          selectedIds={selectedIds}
          toggleSelection={toggleSelection}
          toggleGroupSelection={toggleGroupSelection}
          expandedIds={expandedIds}
          getExpansionKey={getExpansionKey}
          toggleExpand={toggleExpand}
          refreshData={refreshData}
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
