"use client";

import * as React from "react";
import { toast } from "react-toastify";
import { Transaction, TransactionService, TransactionType } from "@/services/transaction-service";
import { useTenant } from "@/providers/tenant-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";

interface FinancialSummary {
  totalIncome: number;
  totalExpense: number;
  pendingIncome: number;
  pendingExpense: number;
}

interface UseFinancialDataReturn {
  transactions: Transaction[];
  summary: FinancialSummary;
  isLoading: boolean;
  hasFinancial: boolean;
  isPlanLoading: boolean;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filterType: TransactionType | "all";
  setFilterType: (type: TransactionType | "all") => void;
  filteredTransactions: Transaction[];
  deleteTransaction: (transaction: Transaction) => Promise<boolean>;
  updateTransactionStatus: (transaction: Transaction, newStatus: Transaction["status"]) => Promise<boolean>;
  refreshData: () => Promise<void>;
}

export function useFinancialData(): UseFinancialDataReturn {
  const { tenant } = useTenant();
  const { hasFinancial, isLoading: isPlanLoading } = usePlanLimits();
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [filterType, setFilterType] = React.useState<TransactionType | "all">("all");
  const [summary, setSummary] = React.useState<FinancialSummary>({
    totalIncome: 0,
    totalExpense: 0,
    pendingIncome: 0,
    pendingExpense: 0,
  });

  const fetchData = React.useCallback(async () => {
    if (!tenant || (!hasFinancial && !isPlanLoading)) return;
    
    setIsLoading(true);
    try {
      const [data, summaryData] = await Promise.all([
        TransactionService.getTransactions(tenant.id),
        TransactionService.getSummary(tenant.id),
      ]);
      setTransactions(data);
      setSummary(summaryData);
    } catch (error) {
      console.error("Failed to fetch transactions", error);
    } finally {
      setIsLoading(false);
    }
  }, [tenant, hasFinancial, isPlanLoading]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredTransactions = React.useMemo(() => {
    let filtered = transactions;

    // Filter out subsequent installments (show only installmentNumber === 1 or non-installments)
    filtered = filtered.filter(
      (t) => !t.isInstallment || t.installmentNumber === 1
    );

    if (filterType !== "all") {
      filtered = filtered.filter((t) => t.type === filterType);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.description.toLowerCase().includes(term) ||
          t.clientName?.toLowerCase().includes(term) ||
          t.category?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [transactions, searchTerm, filterType]);

  const deleteTransaction = React.useCallback(async (transaction: Transaction): Promise<boolean> => {
    try {
      await TransactionService.deleteTransaction(transaction.id);
      setTransactions((prev) => prev.filter((t) => t.id !== transaction.id));
      // Refresh summary
      if (tenant) {
        const summaryData = await TransactionService.getSummary(tenant.id);
        setSummary(summaryData);
      }
      toast.success("Lançamento excluído com sucesso!");
      return true;
    } catch (error) {
      console.error("Error deleting transaction:", error);
      toast.error("Erro ao excluir lançamento");
      return false;
    }
  }, [tenant]);

  const updateTransactionStatus = React.useCallback(async (
    transaction: Transaction,
    newStatus: Transaction["status"]
  ): Promise<boolean> => {
    try {
      await TransactionService.updateTransaction(transaction.id, { status: newStatus });
      // Update local state
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === transaction.id ? { ...t, status: newStatus } : t
        )
      );
      // Refresh summary
      if (tenant) {
        const summaryData = await TransactionService.getSummary(tenant.id);
        setSummary(summaryData);
      }
      toast.success("Status atualizado!");
      return true;
    } catch (error) {
      console.error("Error updating transaction status:", error);
      toast.error("Erro ao atualizar status");
      return false;
    }
  }, [tenant]);

  return {
    transactions,
    summary,
    isLoading,
    hasFinancial,
    isPlanLoading,
    searchTerm,
    setSearchTerm,
    filterType,
    setFilterType,
    filteredTransactions,
    deleteTransaction,
    updateTransactionStatus,
    refreshData: fetchData,
  };
}
