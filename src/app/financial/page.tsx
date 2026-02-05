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
  } = useFinancialData();

  const isLoading = tenantLoading || dataLoading || isPlanLoading;

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [transactionToDelete, setTransactionToDelete] =
    React.useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Selection state
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

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
  if (isLoading) {
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
    } else {
      setFilterStatus("all");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Balance */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financeiro</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie receitas e despesas
          </p>
        </div>

        <div className="flex items-center gap-4 md:gap-8">
          <div className="text-center md:text-right">
            <div className="flex items-center gap-2 text-muted-foreground mb-1 justify-center md:justify-end">
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
      {transactions.length === 0 ? (
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
          transactions={filteredTransactions}
          canEdit={canEdit}
          canDelete={canDelete}
          onDelete={openDeleteDialog}
          onStatusChange={updateGroupStatus}
          onUpdate={updateTransaction}
          selectedIds={selectedIds}
          onToggleSelection={toggleSelection}
          onToggleSelectAll={toggleSelectAll}
        />
      ) : (
        <div className="grid gap-3">
          {filteredTransactions.map((transaction) => {
            // Check if this transaction is part of a group (installment or proposal)
            const groupId =
              transaction.proposalGroupId || transaction.installmentGroupId;

            if (groupId) {
              // Find all transactions in this group within the full dataset
              // (Correctness: we use 'transactions' to find all members, not just filtered ones,
              // so the group logic holds even if some members are filtered out?
              // Actually, usually we want to show the group if ANY member is in the filter?
              // For now, let's stick to the current logic: find "leader" in the COMPLETED list
              // to ensure consistent leader selection)
              const groupMembers = transactions.filter(
                (t) =>
                  t.proposalGroupId === groupId ||
                  t.installmentGroupId === groupId,
              );

              // Sort members to find the "leader"
              // Priority: Down Payment -> Installment Number (asc) -> Date (asc)
              groupMembers.sort((a, b) => {
                if (a.isDownPayment && !b.isDownPayment) return -1;
                if (!a.isDownPayment && b.isDownPayment) return 1;
                if ((a.installmentNumber || 0) !== (b.installmentNumber || 0)) {
                  return (
                    (a.installmentNumber || 0) - (b.installmentNumber || 0)
                  );
                }
                return new Date(a.date).getTime() - new Date(b.date).getTime();
              });

              // If it IS the leader, we render it, passing the group members
              // We render the representative transaction (which might be the leader or the active installment)
              // The hook useFinancialData ensures only one representative per group exists in filtereTransactions

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
                />
              );
            }

            // Standalone transactions
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
              />
            );
          })}
        </div>
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
