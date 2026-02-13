"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UpgradeRequired } from "@/components/ui/upgrade-required";
import { usePagePermission } from "@/hooks/usePagePermission";
import { Transaction } from "@/services/transaction-service";
import { Plus, Wallet, Search, X } from "lucide-react";
import { formatCurrency } from "@/utils/format";
import { useFinancialData } from "./_hooks/useFinancialData";
import { FinancialSkeleton } from "./_components/financial-skeleton";
import { useTenant } from "@/providers/tenant-provider";
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

/** Infinite scroll wrapper for grouped transaction cards */
function TransactionListInfinite({
  filteredTransactions,
  transactions,
  canEdit,
  canDelete,
  openDeleteDialog,
  updateGroupStatus,
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
}: {
  filteredTransactions: Transaction[];
  transactions: Transaction[];
  canEdit: boolean;
  canDelete: boolean;
  openDeleteDialog: (t: Transaction) => void;
  updateGroupStatus: Parameters<typeof TransactionCard>[0]["onStatusChange"];
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
}) {
  const { displayedItems, hasMore, sentinelRef } = useInfiniteScroll(
    filteredTransactions,
    6,
  );

  return (
    <div className="flex flex-col gap-3 flex-1">
      {displayedItems.map((transaction) => {
        const groupId =
          transaction.proposalGroupId || transaction.installmentGroupId;

        if (groupId) {
          const groupMembers = transactions.filter(
            (t) =>
              t.proposalGroupId === groupId || t.installmentGroupId === groupId,
          );

          groupMembers.sort((a, b) => {
            if (a.isDownPayment && !b.isDownPayment) return -1;
            if (!a.isDownPayment && b.isDownPayment) return 1;
            if ((a.installmentNumber || 0) !== (b.installmentNumber || 0)) {
              return (a.installmentNumber || 0) - (b.installmentNumber || 0);
            }
            return new Date(a.date).getTime() - new Date(b.date).getTime();
          });

          return (
            <TransactionCard
              key={transaction.id}
              transaction={transaction}
              relatedInstallments={
                !transaction.proposalGroupId ? groupMembers : []
              }
              proposalGroupTransactions={
                transaction.proposalGroupId ? groupMembers : []
              }
              canEdit={canEdit}
              canDelete={canDelete}
              onDelete={openDeleteDialog}
              onStatusChange={updateGroupStatus}
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
            />
          );
        }

        return (
          <TransactionCard
            key={transaction.id}
            transaction={transaction}
            relatedInstallments={[]}
            proposalGroupTransactions={[]}
            canEdit={canEdit}
            canDelete={canDelete}
            onDelete={openDeleteDialog}
            onStatusChange={updateGroupStatus}
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
  const { isLoading: tenantLoading } = useTenant();
  const { canCreate, canEdit, canDelete } = usePagePermission("financial");
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
    updateTransaction,
    updateBatchTransactions,
    registerPartialPayment,
    transactions,
    refreshData,
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
    if (t.installmentGroupId) return `installment-${t.installmentGroupId}`;
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

      // Add proposal group members
      if (transaction.proposalGroupId) {
        transactions.forEach((t) => {
          if (
            t.proposalGroupId === transaction.proposalGroupId &&
            t.id !== transaction.id
          ) {
            relatedIds.push(t.id);
          }
        });
      }
      // Add installment group members (for non-proposal groups)
      else if (transaction.installmentGroupId && !transaction.proposalGroupId) {
        transactions.forEach((t) => {
          if (
            t.installmentGroupId === transaction.installmentGroupId &&
            t.id !== transaction.id
          ) {
            relatedIds.push(t.id);
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

  // Handle selection when filters or view mode changes
  React.useEffect(() => {
    if (viewMode === "byDueDate") {
      // Auto-select all filtered transactions in byDueDate mode
      const allIds = filteredTransactions.map((t) => t.id);
      setSelectedIds(new Set(allIds));
    } else {
      setSelectedIds(new Set());
    }
  }, [
    viewMode,
    filterType,
    filterStatus,
    filterWallet,
    filterStartDate,
    filterEndDate,
    searchTerm,
    // Checkboxes should update when the list changes
    filteredTransactions,
  ]);

  // Calculate selection summary - use ALL transactions, not just filtered
  const selectionSummary = React.useMemo(() => {
    if (selectedIds.size === 0) return undefined;

    // Use all transactions to include installments that may not be in filteredTransactions
    const selected = transactions.filter((t) => selectedIds.has(t.id));

    return {
      count: selected.length,
      paidIncome: selected
        .filter((t) => t.type === "income" && t.status === "paid")
        .reduce((sum, t) => sum + t.amount, 0),
      paidExpense: selected
        .filter((t) => t.type === "expense" && t.status === "paid")
        .reduce((sum, t) => sum + t.amount, 0),
      pendingIncome: selected
        .filter((t) => t.type === "income" && t.status !== "paid")
        .reduce((sum, t) => sum + t.amount, 0),
      pendingExpense: selected
        .filter((t) => t.type === "expense" && t.status !== "paid")
        .reduce((sum, t) => sum + t.amount, 0),
    };
  }, [selectedIds, transactions]);

  // Use total wallet balance OR calculation from selected items
  const balance = React.useMemo(() => {
    // User requested that balance NEVER filters/changes with selection
    // if (selectedIds.size > 0 && selectionSummary) {
    //   return selectionSummary.paidIncome - selectionSummary.paidExpense;
    // }
    return totalWalletBalance;
  }, [totalWalletBalance]);

  // Show loading first - before checking plan access to avoid flash
  // Show loading first - before checking plan access to avoid flash
  if (tenantLoading || isPlanLoading) {
    return <FinancialSkeleton />;
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
      setFilterStatus("pending");
      setFilterDateType("dueDate");
    } else {
      setFilterStatus("all");
    }
  };

  return (
    <div className="space-y-6 flex flex-col min-h-[calc(100vh_-_180px)]">
      {/* Header with Balance */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lançamentos</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie receitas e despesas
          </p>
        </div>

        <div className="flex items-center gap-4 md:gap-8">
          <div className="text-center md:text-right">
            <div className="flex items-center gap-2 text-muted-foreground mb-1 justify-center md:justify-center">
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

          {canCreate && (
            <Link href="/financial/new">
              <Button size="lg" className="gap-2">
                <Plus className="w-5 h-5" />
                Novo Lançamento
              </Button>
            </Link>
          )}
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
          balance={filteredTransactions.length === 0 ? 0 : balance}
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
              <Link href="/financial/new">
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
          canEdit={canEdit}
          canDelete={canDelete}
          onDelete={openDeleteDialog}
          onStatusChange={updateGroupStatus}
          onUpdate={updateTransaction}
          selectedIds={selectedIds}
          onToggleSelection={toggleSelection}
          onToggleSelectAll={toggleSelectAll}
          onSort={requestSort}
          sortConfig={sortConfig}
        />
      ) : (
        <TransactionListInfinite
          filteredTransactions={filteredTransactions}
          transactions={transactions}
          canEdit={canEdit}
          canDelete={canDelete}
          openDeleteDialog={openDeleteDialog}
          updateGroupStatus={updateGroupStatus}
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
    </div>
  );
}
