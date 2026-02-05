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
  viewMode: "grouped" | "byDueDate";
  setViewMode: (mode: "grouped" | "byDueDate") => void;
  filteredTransactions: Transaction[];
  totalWalletBalance: number;
  deleteTransaction: (transaction: Transaction) => Promise<boolean>;
  deleteTransactionGroup: (transaction: Transaction) => Promise<boolean>;
  updateTransactionStatus: (
    transaction: Transaction,
    newStatus: Transaction["status"],
  ) => Promise<boolean>;
  updateTransaction: (
    transaction: Transaction,
    data: Partial<Transaction>,
  ) => Promise<boolean>;
  updateBatchTransactions: (
    updates: { id: string; data: Partial<Transaction> }[],
  ) => Promise<boolean>;
  updateGroupStatus: (
    transaction: Transaction,
    newStatus: Transaction["status"],
  ) => Promise<boolean>;
  registerPartialPayment: (
    originalTransaction: Transaction,
    amount: number,
    date: string,
  ) => Promise<void>;
  refreshData: () => Promise<void>;
}

export function useFinancialData(): UseFinancialDataReturn {
  const { tenant } = useTenant();
  const { hasFinancial, isLoading: isPlanLoading } = usePlanLimits();
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [filterType, setFilterType] = React.useState<TransactionType | "all">(
    "all",
  );
  const [filterStatus, setFilterStatus] = React.useState<
    TransactionStatus | "all"
  >("all");
  const [filterWallet, setFilterWallet] = React.useState<string>("");
  const [filterStartDate, setFilterStartDate] = React.useState<string>("");
  const [filterEndDate, setFilterEndDate] = React.useState<string>("");
  const [filterDateType, setFilterDateType] = React.useState<
    "date" | "dueDate"
  >("dueDate");
  const [sortBy, setSortBy] = React.useState<"date" | "created">("created");
  const [viewMode, setViewMode] = React.useState<"grouped" | "byDueDate">(
    "grouped",
  );
  const [totalWalletBalance, setTotalWalletBalance] = React.useState<number>(0);
  const [summary, setSummary] = React.useState<FinancialSummary>({
    totalIncome: 0,
    totalExpense: 0,
    pendingIncome: 0,
    pendingExpense: 0,
  });

  const fetchData = React.useCallback(
    async (background = false) => {
      if (!tenant || (!hasFinancial && !isPlanLoading)) return;

      if (!background) setIsLoading(true);
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
        if (!background) setIsLoading(false);
      }
    },
    [tenant, hasFinancial, isPlanLoading],
  );

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredTransactions = React.useMemo(() => {
    let effectiveTransactions: Transaction[] = [];

    // In "byDueDate" mode, show all individual transactions (ungrouped)
    // In "grouped" mode, show grouped as before
    if (viewMode === "byDueDate") {
      // Show all transactions individually, sorted by due date
      effectiveTransactions = [...transactions];
    } else {
      // Original grouped logic
      // 1. Group by proposalGroupId first, then by installmentGroupId
      const processedProposalGroups = new Set<string>();
      const processedInstallmentGroups = new Set<string>();

      // Pre-sort transactions by date to ensure order (though we sort again later)
      // We need to look at all transactions to find the representatives
      const sortedRaw = [...transactions].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );

      sortedRaw.forEach((t) => {
        // CASE 1: Transaction is part of a proposal group (has both down payment and installments)
        if (t.proposalGroupId) {
          if (processedProposalGroups.has(t.proposalGroupId)) return;

          // Find all transactions belonging to this proposal group
          const proposalGroup = transactions.filter(
            (g) => g.proposalGroupId === t.proposalGroupId,
          );

          // Find the down payment transaction as the base for the representative
          let base = proposalGroup.find((g) => g.isDownPayment);
          if (!base && proposalGroup.length > 0) base = proposalGroup[0];

          if (base) {
            // Calculate aggregate status
            // Priority: Overdue > Pending > Paid
            let aggregateStatus: Transaction["status"] = "paid";

            const hasOverdue = proposalGroup.some(
              (g) => g.status === "overdue",
            );
            const hasPending = proposalGroup.some(
              (g) => g.status === "pending",
            );

            if (hasOverdue) {
              aggregateStatus = "overdue";
            } else if (hasPending) {
              aggregateStatus = "pending";
            }

            // Create a synthetic representative with the aggregate status
            // This ensures the main card reflects the group state
            const representative = {
              ...base,
              status: aggregateStatus,
            };

            effectiveTransactions.push(representative);
            processedProposalGroups.add(t.proposalGroupId);

            // Also mark the installmentGroupId as processed to avoid duplicates
            const installmentGroupIds = proposalGroup
              .filter((g) => g.installmentGroupId)
              .map((g) => g.installmentGroupId!);
            installmentGroupIds.forEach((id) =>
              processedInstallmentGroups.add(id),
            );
          }
          return;
        }

        // CASE 2: Transaction is part of an installment group (without proposal group)
        // This includes both regular installments AND down payments (isDownPayment = true)
        if ((t.isInstallment || t.isDownPayment) && t.installmentGroupId) {
          if (processedInstallmentGroups.has(t.installmentGroupId)) return;

          // Find all belonging to this group (both installments and down payments)
          const group = transactions.filter(
            (g) => g.installmentGroupId === t.installmentGroupId,
          );

          // Sort group: down payment first (installmentNumber 0), then by installment number
          group.sort((a, b) => {
            if (a.isDownPayment && !b.isDownPayment) return -1;
            if (!a.isDownPayment && b.isDownPayment) return 1;
            return (a.installmentNumber || 0) - (b.installmentNumber || 0);
          });

          // Find the first "pending" or "overdue" item (not paid)
          let active = group.find((g) => g.status !== "paid");

          // If all are paid, show the last one
          if (!active && group.length > 0) {
            active = group[group.length - 1];
          }

          // If for some reason we didn't find one (empty group?), skip
          if (active) {
            effectiveTransactions.push(active);
            processedInstallmentGroups.add(t.installmentGroupId);
          }
          return;
        }

        // CASE 3: Regular transaction (not part of any group)
        effectiveTransactions.push(t);
      });
    }

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
        // For installment transactions in GROUPED mode, check if ANY installment in the group matches the date range
        if (
          viewMode === "grouped" &&
          filterDateType === "dueDate" &&
          t.isInstallment &&
          t.installmentGroupId
        ) {
          // Get all installments in this group
          const group = transactions.filter(
            (g) => g.installmentGroupId === t.installmentGroupId,
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

        // For non-installment transactions or byDueDate mode, use the transaction's own date
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
          t.wallet?.toLowerCase().includes(term),
      );
    }

    // Sort
    if (viewMode === "byDueDate") {
      // In byDueDate mode, always sort by due date (closest first)
      return filtered.sort((a, b) => {
        const getDueDateMs = (t: Transaction) => {
          if (!t.dueDate) return Infinity; // Items without due date go to the end
          const dateStr = getDateString(t.dueDate);
          if (!dateStr) return Infinity;
          return new Date(dateStr).getTime();
        };
        return getDueDateMs(a) - getDueDateMs(b);
      });
    } else {
      // Original sorting logic for grouped mode
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
    }
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
    viewMode,
  ]);

  // Delete a single transaction (individual installment)
  const deleteTransaction = React.useCallback(
    async (transaction: Transaction): Promise<boolean> => {
      try {
        await TransactionService.deleteTransaction(transaction.id);

        // Optimistic update
        setTransactions((prev) => prev.filter((t) => t.id !== transaction.id));

        // Refresh truth from server (background)
        await fetchData(true);

        toast.success("Lançamento excluído com sucesso!");
        return true;
      } catch (error) {
        console.error("Error deleting transaction:", error);
        toast.error("Erro ao excluir lançamento");
        return false;
      }
    },
    [fetchData],
  );

  // Delete all installments in a group
  const deleteTransactionGroup = React.useCallback(
    async (transaction: Transaction): Promise<boolean> => {
      try {
        // If it's an installment, delete all in the group
        if (
          (transaction.isInstallment || transaction.isDownPayment) &&
          transaction.installmentGroupId
        ) {
          const groupTransactions = transactions.filter(
            (t) => t.installmentGroupId === transaction.installmentGroupId,
          );

          // Delete all installments
          await Promise.all(
            groupTransactions.map((t) =>
              TransactionService.deleteTransaction(t.id),
            ),
          );

          // Optimistic update
          const groupIds = new Set(groupTransactions.map((t) => t.id));
          setTransactions((prev) => prev.filter((t) => !groupIds.has(t.id)));

          toast.success(
            `${groupTransactions.length} parcelas excluídas com sucesso!`,
          );
        } else {
          // Single transaction
          await TransactionService.deleteTransaction(transaction.id);
          setTransactions((prev) =>
            prev.filter((t) => t.id !== transaction.id),
          );
          toast.success("Lançamento excluído com sucesso!");
        }

        // Refresh truth from server (background)
        await fetchData(true);

        return true;
      } catch (error) {
        console.error("Error deleting transaction group:", error);
        toast.error("Erro ao excluir lançamentos");
        return false;
      }
    },
    [transactions, fetchData],
  );

  // Update single transaction status
  const updateTransactionStatus = React.useCallback(
    async (
      transaction: Transaction,
      newStatus: Transaction["status"],
    ): Promise<boolean> => {
      try {
        await TransactionService.updateTransaction(transaction.id, {
          status: newStatus,
        });

        // Optimistic update
        setTransactions((prev) =>
          prev.map((t) =>
            t.id === transaction.id ? { ...t, status: newStatus } : t,
          ),
        );

        toast.success("Status atualizado!");

        // Refresh truth from server (background)
        await fetchData(true);

        return true;
      } catch (error) {
        console.error("Error updating transaction status:", error);
        toast.error("Erro ao atualizar status");
        return false;
      }
    },
    [fetchData],
  );

  // Generic update transaction
  const updateTransaction = React.useCallback(
    async (
      transaction: Transaction,
      data: Partial<Transaction>,
    ): Promise<boolean> => {
      try {
        await TransactionService.updateTransaction(transaction.id, data);

        // Optimistic update
        setTransactions((prev) =>
          prev.map((t) => (t.id === transaction.id ? { ...t, ...data } : t)),
        );

        toast.success("Lançamento atualizado!");

        // Refresh truth from server (background)
        await fetchData(true);

        return true;
      } catch (error) {
        console.error("Error updating transaction:", error);
        toast.error("Erro ao atualizar lançamento");
        return false;
      }
    },
    [fetchData],
  );

  // Batch update transactions
  const updateBatchTransactions = React.useCallback(
    async (
      updates: { id: string; data: Partial<Transaction> }[],
    ): Promise<boolean> => {
      try {
        await Promise.all(
          updates.map((update) =>
            TransactionService.updateTransaction(update.id, update.data),
          ),
        );

        // Optimistic update
        setTransactions((prev) => {
          const updatesMap = new Map(updates.map((u) => [u.id, u.data]));
          return prev.map((t) => {
            const update = updatesMap.get(t.id);
            return update ? { ...t, ...update } : t;
          });
        });

        toast.success(`${updates.length} lançamentos atualizados!`);

        // Refresh truth from server (background)
        await fetchData(true);

        return true;
      } catch (error) {
        console.error("Error updating batch:", error);
        toast.error("Erro ao atualizar lançamentos");
        return false;
      }
    },
    [fetchData],
  );

  // Update status for all installments in a group OR single
  const updateGroupStatus = React.useCallback(
    async (
      transaction: Transaction,
      newStatus: Transaction["status"],
      updateAll: boolean = true,
    ): Promise<boolean> => {
      try {
        // Check if this is a proposal group (has proposalGroupId)
        const hasProposalGroup = transaction.proposalGroupId && updateAll;

        // Check if this is an installment group
        const hasInstallmentGroup =
          transaction.isInstallment &&
          transaction.installmentGroupId &&
          updateAll;

        if (hasProposalGroup) {
          // Update all transactions in the proposal group (down payment + all installments)
          const groupTransactions = transactions.filter(
            (t) => t.proposalGroupId === transaction.proposalGroupId,
          );

          // Update all in parallel
          await Promise.all(
            groupTransactions.map((t) =>
              TransactionService.updateTransaction(t.id, {
                status: newStatus,
              }),
            ),
          );

          // Update local state for all
          const groupIds = new Set(groupTransactions.map((t) => t.id));
          setTransactions((prev) =>
            prev.map((t) =>
              groupIds.has(t.id) ? { ...t, status: newStatus } : t,
            ),
          );

          toast.success(
            `${groupTransactions.length} lançamentos da proposta atualizados!`,
          );
        } else if (hasInstallmentGroup) {
          // Update all installments in the installment group
          const groupTransactions = transactions.filter(
            (t) => t.installmentGroupId === transaction.installmentGroupId,
          );

          // Update all installments in parallel
          await Promise.all(
            groupTransactions.map((t) =>
              TransactionService.updateTransaction(t.id, {
                status: newStatus,
              }),
            ),
          );

          // Update local state for all
          const groupIds = new Set(groupTransactions.map((t) => t.id));
          setTransactions((prev) =>
            prev.map((t) =>
              groupIds.has(t.id) ? { ...t, status: newStatus } : t,
            ),
          );

          toast.success(`${groupTransactions.length} parcelas atualizadas!`);
        } else {
          // Single transaction (or single installment update)
          await TransactionService.updateTransaction(transaction.id, {
            status: newStatus,
          });
          setTransactions((prev) =>
            prev.map((t) =>
              t.id === transaction.id ? { ...t, status: newStatus } : t,
            ),
          );
          toast.success("Status atualizado!");
        }

        // Refresh truth from server (background)
        await fetchData(true);

        return true;
      } catch (error) {
        console.error("Error updating status:", error);
        toast.error("Erro ao atualizar status");
        return false;
      }
    },
    [transactions, fetchData],
  );

  // Register partial payment
  const registerPartialPayment = React.useCallback(
    async (
      originalTransaction: Transaction,
      amount: number,
      date: string,
    ): Promise<void> => {
      try {
        const remainingAmount = originalTransaction.amount - amount;

        // 1. Update original to be the remaining part (keeping same ID)
        await TransactionService.updateTransaction(originalTransaction.id, {
          amount: remainingAmount,
        });

        // 2. Create new transaction for the paid part
        await TransactionService.createTransaction({
          ...originalTransaction,
          amount: amount,
          status: "paid",
          date: date,
          description: originalTransaction.description, // Keep description
          isPartialPayment: true,
          parentTransactionId: originalTransaction.id,
          // IDs managed by backend or preserved if needed (but createTransaction usually handles ID gen)
          // We probably want to keep proposalGroupId and installmentGroupId to keep them linked
        });

        toast.success("Pagamento parcial registrado com sucesso!");

        // Refresh truth from server (background)
        await fetchData(true);
      } catch (error) {
        console.error("Error registering partial payment:", error);
        toast.error("Erro ao registrar pagamento parcial");
        throw error;
      }
    },
    [fetchData],
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
    viewMode,
    setViewMode,
    filteredTransactions,
    totalWalletBalance,
    deleteTransaction,
    deleteTransactionGroup,
    updateTransactionStatus,
    updateTransaction,
    updateBatchTransactions,
    updateGroupStatus,
    registerPartialPayment,
    refreshData: fetchData,
  };
}
