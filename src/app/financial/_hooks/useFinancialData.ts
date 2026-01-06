"use client";

import * as React from "react";
import { toast } from "react-toastify";
import {
  Transaction,
  TransactionService,
  TransactionType,
  TransactionStatus,
} from "@/services/transaction-service";
import { WalletService } from "@/services/wallet-service";
import { useTenant } from "@/providers/tenant-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";

type DateLike =
  | string
  | Date
  | { toDate: () => Date }
  | { toMillis: () => number }
  | { seconds: number }
  | null
  | undefined;

// Helper to get YYYY-MM-DD string in Local Time matching user perception
function getDateString(val: DateLike): string {
  if (!val) return "";

  // If it's a string, handle it carefully to avoid timezone issues
  if (typeof val === "string") {
    // If it's just a date (YYYY-MM-DD), return as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      return val;
    }
    // If it has a time component (ISO format), extract just the date part
    // This avoids timezone conversion issues
    if (val.includes("T")) {
      return val.split("T")[0];
    }
    // For other string formats, try to parse and convert
    // Parse as local date to avoid timezone shift
    const parts = val.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (parts) {
      return `${parts[1]}-${parts[2]}-${parts[3]}`;
    }
    // Fallback: try parsing as date
    const date = new Date(val + "T12:00:00"); // Add noon time to avoid day boundary issues
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    return "";
  }

  let date: Date;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = val as any;
  if (typeof v?.toDate === "function") date = v.toDate();
  else if (v?.seconds) date = new Date(v.seconds * 1000);
  else date = new Date(v);

  if (isNaN(date.getTime())) return "";

  // Use local component methods to ensure it matches what user sees on screen
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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
  filterStatus: TransactionStatus | "all";
  setFilterStatus: (status: TransactionStatus | "all") => void;
  filterWallet: string;
  setFilterWallet: (wallet: string) => void;
  filterStartDate: string;
  setFilterStartDate: (date: string) => void;
  filterEndDate: string;
  setFilterEndDate: (date: string) => void;
  filterDateType: "date" | "dueDate";
  setFilterDateType: (type: "date" | "dueDate") => void;
  sortBy: "date" | "created";
  setSortBy: (sort: "date" | "created") => void;
  filteredTransactions: Transaction[];
  totalWalletBalance: number;
  deleteTransaction: (transaction: Transaction) => Promise<boolean>;
  updateTransactionStatus: (
    transaction: Transaction,
    newStatus: Transaction["status"]
  ) => Promise<boolean>;
  refreshData: () => Promise<void>;
}

export function useFinancialData(): UseFinancialDataReturn {
  const { tenant } = useTenant();
  const { hasFinancial, isLoading: isPlanLoading } = usePlanLimits();
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [filterType, setFilterType] = React.useState<TransactionType | "all">(
    "all"
  );
  const [filterStatus, setFilterStatus] = React.useState<
    TransactionStatus | "all"
  >("all");
  const [filterWallet, setFilterWallet] = React.useState<string>("");
  const [filterStartDate, setFilterStartDate] = React.useState<string>("");
  const [filterEndDate, setFilterEndDate] = React.useState<string>("");
  const [filterDateType, setFilterDateType] = React.useState<
    "date" | "dueDate"
  >("date");
  const [sortBy, setSortBy] = React.useState<"date" | "created">("created");
  const [totalWalletBalance, setTotalWalletBalance] = React.useState<number>(0);
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
      const [data, summaryData, wallets] = await Promise.all([
        TransactionService.getTransactions(tenant.id),
        TransactionService.getSummary(tenant.id),
        WalletService.getWallets(tenant.id),
      ]);
      setTransactions(data);
      setSummary(summaryData);

      // Calculate total wallet balance from active wallets
      const totalBalance = wallets
        .filter((w) => w.status === "active")
        .reduce((sum, w) => sum + w.balance, 0);
      setTotalWalletBalance(totalBalance);
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
    // 1. Group installments and select the "active" one for each group
    const processedGroups = new Set<string>();
    const effectiveTransactions: Transaction[] = [];

    // Pre-sort transactions by date to ensure order (though we sort again later)
    // We need to look at all transactions to find the representatives
    const sortedRaw = [...transactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    sortedRaw.forEach((t) => {
      if (!t.isInstallment || !t.installmentGroupId) {
        effectiveTransactions.push(t);
        return;
      }

      if (processedGroups.has(t.installmentGroupId)) return;

      // Find all belonging to this group
      const group = transactions.filter(
        (g) => g.installmentGroupId === t.installmentGroupId
      );

      // Sort group by installment number
      group.sort(
        (a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0)
      );

      // Find the first "pending" or "overdue" installment (not paid)
      let active = group.find((g) => g.status !== "paid");

      // If all are paid, show the last one
      if (!active && group.length > 0) {
        active = group[group.length - 1];
      }

      // If for some reason we didn't find one (empty group?), skip
      if (active) {
        effectiveTransactions.push(active);
        processedGroups.add(t.installmentGroupId);
      }
    });

    let filtered = effectiveTransactions;

    // Filter by type
    if (filterType !== "all") {
      filtered = filtered.filter((t) => t.type === filterType);
    }

    // Filter by status
    if (filterStatus !== "all") {
      filtered = filtered.filter((t) => t.status === filterStatus);
    }

    // Filter by wallet
    if (filterWallet) {
      filtered = filtered.filter((t) => t.wallet === filterWallet);
    }

    // Filter by date range
    if (filterStartDate || filterEndDate) {
      filtered = filtered.filter((t) => {
        // For installment transactions, check if ANY installment in the group matches the date range
        if (
          filterDateType === "dueDate" &&
          t.isInstallment &&
          t.installmentGroupId
        ) {
          // Get all installments in this group
          const group = transactions.filter(
            (g) => g.installmentGroupId === t.installmentGroupId
          );

          // Check if ANY installment has dueDate in the range
          const hasMatchingInstallment = group.some((installment) => {
            if (!installment.dueDate) return false;
            const dueDateStr = getDateString(installment.dueDate);
            if (!dueDateStr) return false;

            if (
              filterStartDate &&
              dueDateStr.localeCompare(filterStartDate) < 0
            ) {
              return false;
            }
            if (filterEndDate && dueDateStr.localeCompare(filterEndDate) > 0) {
              return false;
            }
            return true;
          });

          return hasMatchingInstallment;
        }

        // For non-installment transactions, use the transaction's own date
        let dateVal: string | undefined = t.date;

        if (filterDateType === "dueDate") {
          // When filtering by due date, only consider transactions that have a due date
          // Don't fallback to main date - if no due date, exclude from filter
          if (!t.dueDate) return false;
          dateVal = t.dueDate;
        }

        const dateStr = getDateString(dateVal);
        if (!dateStr) return false;

        // Compare dates using localeCompare for reliable string comparison
        if (filterStartDate) {
          // dateStr must be >= filterStartDate
          if (dateStr.localeCompare(filterStartDate) < 0) return false;
        }
        if (filterEndDate) {
          // dateStr must be <= filterEndDate
          if (dateStr.localeCompare(filterEndDate) > 0) return false;
        }
        return true;
      });
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.description.toLowerCase().includes(term) ||
          t.clientName?.toLowerCase().includes(term) ||
          t.category?.toLowerCase().includes(term) ||
          t.wallet?.toLowerCase().includes(term)
      );
    }

    // Sort
    return filtered.sort((a, b) => {
      if (sortBy === "date") {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      } else {
        // Handle Firestore Timestamp or string for createdAt
        const getMillis = (val: DateLike) => {
          if (!val) return 0;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const v = val as any;
          if (typeof v?.toMillis === "function") return v.toMillis(); // Firestore SDK
          if (v?.seconds) return v.seconds * 1000; // Serialized
          return new Date(v).getTime(); // String/Date
        };
        return getMillis(b.createdAt) - getMillis(a.createdAt);
      }
    });
  }, [
    transactions,
    searchTerm,
    filterType,
    filterStatus,
    filterWallet,
    filterStartDate,
    filterEndDate,
    filterDateType,
    sortBy,
  ]);

  const deleteTransaction = React.useCallback(
    async (transaction: Transaction): Promise<boolean> => {
      try {
        await TransactionService.deleteTransaction(transaction.id);
        setTransactions((prev) => prev.filter((t) => t.id !== transaction.id));
        // Refresh summary and wallet balance
        if (tenant) {
          const [summaryData, wallets] = await Promise.all([
            TransactionService.getSummary(tenant.id),
            WalletService.getWallets(tenant.id),
          ]);
          setSummary(summaryData);
          const totalBalance = wallets
            .filter((w) => w.status === "active")
            .reduce((sum, w) => sum + w.balance, 0);
          setTotalWalletBalance(totalBalance);
        }
        toast.success("Lançamento excluído com sucesso!");
        return true;
      } catch (error) {
        console.error("Error deleting transaction:", error);
        toast.error("Erro ao excluir lançamento");
        return false;
      }
    },
    [tenant]
  );

  const updateTransactionStatus = React.useCallback(
    async (
      transaction: Transaction,
      newStatus: Transaction["status"]
    ): Promise<boolean> => {
      try {
        await TransactionService.updateTransaction(transaction.id, {
          status: newStatus,
        });
        // Update local state
        setTransactions((prev) =>
          prev.map((t) =>
            t.id === transaction.id ? { ...t, status: newStatus } : t
          )
        );
        // Refresh summary and wallet balance
        if (tenant) {
          const [summaryData, wallets] = await Promise.all([
            TransactionService.getSummary(tenant.id),
            WalletService.getWallets(tenant.id),
          ]);
          setSummary(summaryData);
          const totalBalance = wallets
            .filter((w) => w.status === "active")
            .reduce((sum, w) => sum + w.balance, 0);
          setTotalWalletBalance(totalBalance);
        }
        toast.success("Status atualizado!");
        return true;
      } catch (error) {
        console.error("Error updating transaction status:", error);
        toast.error("Erro ao atualizar status");
        return false;
      }
    },
    [tenant]
  );

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
    deleteTransaction,
    updateTransactionStatus,
    refreshData: fetchData,
  };
}
