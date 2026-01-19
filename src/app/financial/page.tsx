"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UpgradeRequired } from "@/components/ui/upgrade-required";
import { usePagePermission } from "@/hooks/usePagePermission";
import { Transaction } from "@/services/transaction-service";
import { Plus, Wallet, Search, Loader2 } from "lucide-react";
import { formatCurrency } from "@/utils/format";
import { useFinancialData } from "./_hooks/useFinancialData";
import { FinancialSkeleton } from "./_components/financial-skeleton";
import { useTenant } from "@/providers/tenant-provider";
import {
  FinancialSummaryCards,
  TransactionCard,
  DeleteTransactionDialog,
  TransactionFilters,
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
    filteredTransactions,
    totalWalletBalance,
    deleteTransactionGroup,
    updateGroupStatus,
    updateTransaction,
    updateBatchTransactions,
    transactions,
  } = useFinancialData();

  const isLoading = tenantLoading || dataLoading || isPlanLoading;

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [transactionToDelete, setTransactionToDelete] =
    React.useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

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

  // Use total wallet balance instead of transaction-based calculation
  const balance = totalWalletBalance;

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

      {/* Summary Cards */}
      <FinancialSummaryCards summary={summary} />

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
      ) : (
        <div className="grid gap-3">
          {filteredTransactions.map((transaction) => {
            // Get related installments (for standalone installment groups)
            // Include both installments AND down payments in the group
            const relatedInstallments =
              (transaction.isInstallment || transaction.isDownPayment) &&
              transaction.installmentGroupId &&
              !transaction.proposalGroupId
                ? transactions
                    .filter(
                      (t) =>
                        t.installmentGroupId === transaction.installmentGroupId
                    )
                    .sort((a, b) => {
                      // Sort: down payment first, then by installment number
                      if (a.isDownPayment && !b.isDownPayment) return -1;
                      if (!a.isDownPayment && b.isDownPayment) return 1;
                      return (
                        (a.installmentNumber || 0) - (b.installmentNumber || 0)
                      );
                    })
                : [];

            // Get all transactions from the same proposal group (down payment + installments)
            const proposalGroupTransactions = transaction.proposalGroupId
              ? transactions
                  .filter(
                    (t) => t.proposalGroupId === transaction.proposalGroupId
                  )
                  .sort((a, b) => {
                    // Down payment first, then installments by number
                    if (a.isDownPayment && !b.isDownPayment) return -1;
                    if (!a.isDownPayment && b.isDownPayment) return 1;
                    return (
                      (a.installmentNumber || 0) - (b.installmentNumber || 0)
                    );
                  })
              : [];

            return (
              <TransactionCard
                key={transaction.id}
                transaction={transaction}
                relatedInstallments={relatedInstallments}
                proposalGroupTransactions={proposalGroupTransactions}
                canEdit={canEdit}
                canDelete={canDelete}
                onDelete={openDeleteDialog}
                onStatusChange={updateGroupStatus}
                onUpdate={updateTransaction}
                onUpdateBatch={updateBatchTransactions}
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
