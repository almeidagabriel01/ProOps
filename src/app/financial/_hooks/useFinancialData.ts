"use client";

import * as React from "react";
import { toast } from "@/lib/toast";
import {
  Transaction,
  TransactionService,
  TransactionType,
  TransactionStatus,
} from "@/services/transaction-service";
import { WalletService } from "@/services/wallet-service";
import { useTenant } from "@/providers/tenant-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { Wallet } from "@/types";
import { normalize } from "@/utils/text";

type DateLike =
  | string
  | Date
  | { toDate: () => Date }
  | { toMillis: () => number }
  | { seconds: number }
  | null
  | undefined;

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

const matchesGroupByHeuristic = (
  orphan: Transaction,
  grouped: Transaction[],
): boolean => {
  if (!isDownPaymentLike(orphan)) return false;
  const matchingGroups = grouped.filter(
    (g) =>
      !!g.installmentGroupId &&
      !g.proposalGroupId &&
      g.type === orphan.type &&
      baseDesc(g.description || "") === baseDesc(orphan.description || "") &&
      sameClient(g, orphan) &&
      dateOnly(g.date) === dateOnly(orphan.date),
  );
  return matchingGroups.length === 1;
};

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

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
};

const formatTransactionLabel = (
  transaction: Pick<Transaction, "id" | "description">,
): string => {
  const description = transaction.description?.trim();
  return description ? `"${description}"` : `ID ${transaction.id}`;
};

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
  updateExtraCostStatus: (
    parentTxId: string,
    ecId: string,
    newStatus: TransactionStatus,
  ) => Promise<boolean>;
  registerPartialPayment: (
    originalTransaction: Transaction,
    amount: number,
    date: string,
  ) => Promise<void>;
  refreshData: (background?: boolean) => Promise<void>;
  wallets: Wallet[];
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
  >("pending");
  const [filterWallet, setFilterWallet] = React.useState<string>("");
  const [filterStartDate, setFilterStartDate] = React.useState<string>("");
  const [filterEndDate, setFilterEndDate] = React.useState<string>("");
  const [filterDateType, setFilterDateType] = React.useState<
    "date" | "dueDate"
  >("dueDate");
  const [sortBy, setSortBy] = React.useState<"date" | "created">("created");
  const [viewMode, setViewMode] = React.useState<"grouped" | "byDueDate">(
    "byDueDate",
  );
  const [wallets, setWallets] = React.useState<Wallet[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [serverSummary, setServerSummary] = React.useState<FinancialSummary>({
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
        const [data, summaryData, walletsData] = await Promise.all([
          TransactionService.getTransactions(tenant.id),
          TransactionService.getSummary(tenant.id),
          WalletService.getWallets(tenant.id),
        ]);
        setTransactions(data);
        setServerSummary(summaryData);
        setWallets(walletsData);
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
    const effectiveTransactions: Transaction[] = [];

    // In "byDueDate" mode, show all individual transactions (ungrouped)
    // In "grouped" mode, show grouped as before
    if (viewMode === "byDueDate") {
      // Show all transactions individually, sorted by due date
      transactions.forEach((t) => {
        effectiveTransactions.push(t);
        // Extract extra costs as independent transactions so filtering and visualization works in the "por vencimento" table
        if (t.extraCosts && t.extraCosts.length > 0) {
          t.extraCosts.forEach((ec) => {
            effectiveTransactions.push({
              ...ec,
              id: ec.id,
              tenantId: t.tenantId,
              type: t.type,
              description:
                ec.description ||
                (t.type === "income" ? "Acréscimo Extra" : "Custo Extra"),
              date: ec.createdAt || t.date,
              dueDate: t.dueDate,
              wallet: ec.wallet || t.wallet,
              status: ec.status || "pending",
              createdAt: ec.createdAt || t.createdAt,
              updatedAt: ec.createdAt || t.updatedAt,
              amount: ec.amount,
              isExtraCostSync: true,
              parentTransactionId: t.id,
            } as Transaction & {
              isExtraCostSync: boolean;
              parentTransactionId: string;
            });
          });
        }
      });
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

      // === PASS 1: Process grouped transactions (proposal groups + installment groups) ===
      // This ensures all group representatives exist in effectiveTransactions
      // before we check orphan down payments in pass 2.
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
        if (t.installmentGroupId) {
          if (processedInstallmentGroups.has(t.installmentGroupId)) return;

          // Find all belonging to this group (both installments and down payments)
          const group = transactions.filter(
            (g) => g.installmentGroupId === t.installmentGroupId,
          );

          // Sort group: down payment first (explicit flag or installmentNumber 0), then by installment number
          group.sort((a, b) => {
            const aIsDown = isDownPaymentLike(a);
            const bIsDown = isDownPaymentLike(b);
            if (aIsDown && !bIsDown) return -1;
            if (!aIsDown && bIsDown) return 1;
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
            const stableAnchor =
              group.find((g) => isDownPaymentLike(g)) || group[0];
            const representative: Transaction = {
              ...active,
              createdAt: stableAnchor?.createdAt || active.createdAt,
            };

            effectiveTransactions.push(representative);
            processedInstallmentGroups.add(t.installmentGroupId);
          }
          return;
        }
      });

      // === PASS 2: Process standalone transactions and orphan down payments ===
      // Now effectiveTransactions contains ALL group representatives,
      // so heuristic matching can correctly find them.
      sortedRaw.forEach((t) => {
        // Skip already-processed grouped transactions
        if (t.proposalGroupId || t.installmentGroupId) return;

        // Orphan down payment — check if it matches a group representative
        if (
          isDownPaymentLike(t) &&
          matchesGroupByHeuristic(t, effectiveTransactions)
        ) {
          return; // Will be attached to its group by page.tsx rendering
        }
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
      filtered = filtered.filter((t) => {
        if (t.status === filterStatus) return true;
        // In byDueDate mode, extra costs are already own rows — don't double-match via parent
        if (
          viewMode !== "byDueDate" &&
          t.extraCosts &&
          t.extraCosts.some((ec) => (ec.status || "pending") === filterStatus)
        )
          return true;
        return false;
      });
    }

    // Filter by wallet
    if (filterWallet) {
      filtered = filtered.filter((t) => {
        if (t.wallet === filterWallet) return true;
        // In byDueDate mode, extra costs are already own rows — don't double-match via parent
        if (
          viewMode !== "byDueDate" &&
          t.extraCosts &&
          t.extraCosts.some((ec) => (ec.wallet || t.wallet) === filterWallet)
        )
          return true;
        return false;
      });
    }

    // Filter by date range
    if (filterStartDate || filterEndDate) {
      filtered = filtered.filter((t) => {
        // For installment transactions in GROUPED mode, check if ANY installment in the group matches the date range
        if (
          viewMode === "grouped" &&
          filterDateType === "dueDate" &&
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
      const term = normalize(searchTerm);
      filtered = filtered.filter(
        (t) =>
          normalize(t.description).includes(term) ||
          normalize(t.clientName || "").includes(term) ||
          normalize(t.category || "").includes(term) ||
          normalize(t.wallet || "").includes(term) ||
          (t.extraCosts &&
            t.extraCosts.some(
              (ec) =>
                normalize(ec.description).includes(term) ||
                normalize(ec.wallet || "").includes(term),
            )),
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

  // Calculate filtered summary
  const summary = React.useMemo(() => {
    const result = {
      totalIncome: 0,
      totalExpense: 0,
      pendingIncome: 0,
      pendingExpense: 0,
    };

    const term = searchTerm.toLowerCase().trim();

    transactions.forEach((t) => {
      // 1. Filter by Type
      if (filterType !== "all" && t.type !== filterType) return;

      // 2. Filter by Date
      let dateVal: string | undefined = t.date;
      if (filterDateType === "dueDate") {
        if (!t.dueDate) return;
        dateVal = t.dueDate;
      }

      const dateStr = getDateString(dateVal);
      if (!dateStr) return;

      if (filterStartDate && dateStr < filterStartDate) return;
      if (filterEndDate && dateStr > filterEndDate) return;

      // Accumulate Main Transaction
      const mainTxMatchesWallet = !filterWallet || t.wallet === filterWallet;
      const mainTxMatchesStatus =
        filterStatus === "all" || t.status === filterStatus;

      let mainTxMatchesSearch = true;
      if (term) {
        const normalizedTerm = normalize(term);
        mainTxMatchesSearch =
          normalize(t.description).includes(normalizedTerm) ||
          normalize(t.clientName || "").includes(normalizedTerm) ||
          normalize(t.category || "").includes(normalizedTerm) ||
          normalize(t.wallet || "").includes(normalizedTerm);
      }

      if (mainTxMatchesWallet && mainTxMatchesStatus && mainTxMatchesSearch) {
        if (t.type === "income") {
          if (t.status === "paid") {
            result.totalIncome += t.amount;
          } else {
            result.pendingIncome += t.amount;
          }
        } else if (t.type === "expense") {
          if (t.status === "paid") {
            result.totalExpense += t.amount;
          } else {
            result.pendingExpense += t.amount;
          }
        }
      }

      // Accumulate Extra Costs
      if (t.extraCosts && t.extraCosts.length > 0) {
        t.extraCosts.forEach((ec) => {
          const ecWallet = ec.wallet || t.wallet;
          const ecStatus = ec.status || "pending";

          if (filterWallet && ecWallet !== filterWallet) return;
          if (filterStatus !== "all" && ecStatus !== filterStatus) return;

          let ecMatchesSearch = true;
          if (term) {
            const normalizedTerm = normalize(term);
            ecMatchesSearch =
              normalize(ec.description).includes(normalizedTerm) ||
              normalize(ecWallet || "").includes(normalizedTerm);
          }
          if (!ecMatchesSearch) return;

          // Extra costs add to the total value of the parent transaction
          if (t.type === "income") {
            if (ecStatus === "paid") result.totalIncome += ec.amount;
            else result.pendingIncome += ec.amount;
          } else {
            if (ecStatus === "paid") result.totalExpense += ec.amount;
            else result.pendingExpense += ec.amount;
          }
        });
      }
    });

    return result;
  }, [
    transactions,
    filterWallet,
    filterType,
    filterStatus,
    searchTerm,
    filterDateType,
    filterStartDate,
    filterEndDate,
  ]);

  const totalWalletBalance = React.useMemo(() => {
    return wallets
      .filter((w) => {
        const isActive = w.status === "active";
        const matchesFilter = filterWallet ? w.id === filterWallet : true;
        return isActive && matchesFilter;
      })
      .reduce((sum, w) => sum + w.balance, 0);
  }, [wallets, filterWallet]);

  // --- Optimistic Wallet Updaters ---
  const calculateWalletImpacts = React.useCallback(
    (tx: Partial<Transaction>) => {
      const impacts = new Map<string, number>();
      const addImpact = (
        wallet: string | null | undefined,
        amount: number,
        isIncome: boolean,
      ) => {
        if (!wallet) return;
        const delta = (isIncome ? 1 : -1) * (amount || 0);
        impacts.set(wallet, (impacts.get(wallet) || 0) + delta);
      };

      if (tx?.status === "paid" && tx?.wallet) {
        addImpact(tx.wallet, tx.amount || 0, tx.type === "income");
      }

      if (tx?.extraCosts && Array.isArray(tx.extraCosts)) {
        for (const ec of tx.extraCosts) {
          if (ec.status === "paid" && (ec.wallet || tx.wallet)) {
            // Extra costs add to the value of the parent transaction (so if parent is income, extra cost is income)
            addImpact(
              ec.wallet || tx.wallet,
              ec.amount || 0,
              tx.type === "income",
            );
          }
        }
      }
      return impacts;
    },
    [],
  );

  const applyOptimisticWalletUpdate = React.useCallback(
    (oldTx: Transaction | undefined, newTx: Transaction | undefined) => {
      setWallets((prev) => {
        const oldImpacts = oldTx ? calculateWalletImpacts(oldTx) : new Map();
        const newImpacts = newTx ? calculateWalletImpacts(newTx) : new Map();
        return prev.map((w) => {
          const oldVal = oldImpacts.get(w.id) || 0;
          const newVal = newImpacts.get(w.id) || 0;
          const diff = newVal - oldVal;
          if (diff === 0) return w;
          return { ...w, balance: w.balance + diff };
        });
      });
    },
    [calculateWalletImpacts],
  );

  const applyOptimisticWalletUpdateBatch = React.useCallback(
    (updates: { oldTx: Transaction; newTx: Transaction }[]) => {
      setWallets((prev) => {
        const netDeltas = new Map<string, number>();
        updates.forEach(({ oldTx, newTx }) => {
          const oldImpacts = calculateWalletImpacts(oldTx);
          const newImpacts = calculateWalletImpacts(newTx);
          for (const [wId, val] of oldImpacts.entries()) {
            netDeltas.set(wId, (netDeltas.get(wId) || 0) - val);
          }
          for (const [wId, val] of newImpacts.entries()) {
            netDeltas.set(wId, (netDeltas.get(wId) || 0) + val);
          }
        });
        return prev.map((w) => {
          const diff = netDeltas.get(w.id) || 0;
          if (diff === 0) return w;
          return { ...w, balance: w.balance + diff };
        });
      });
    },
    [calculateWalletImpacts],
  );
  // ----------------------------------

  // Delete a single transaction (individual installment)
  const deleteTransaction = React.useCallback(
    async (transaction: Transaction): Promise<boolean> => {
      const transactionLabel = formatTransactionLabel(transaction);

      try {
        await TransactionService.deleteTransaction(transaction.id);

        // Optimistic update
        applyOptimisticWalletUpdate(transaction, {
          ...transaction,
          status: "pending",
          extraCosts: transaction.extraCosts?.map((ec) => ({
            ...ec,
            status: "pending" as const,
          })),
        } as Transaction);
        setTransactions((prev) => prev.filter((t) => t.id !== transaction.id));

        // Refresh truth from server (background)
        await fetchData(true);

        toast.success(
          `Lancamento ${transactionLabel} foi excluido com sucesso.`,
          {
            title: "Sucesso ao excluir",
          },
        );
        return true;
      } catch (error) {
        console.error("Error deleting transaction:", error);
        const errorMessage = getErrorMessage(
          error,
          "Falha inesperada ao excluir o lancamento.",
        );
        toast.error(
          `Nao foi possivel excluir o lancamento ${transactionLabel}. Detalhes: ${errorMessage}`,
          { title: "Erro ao excluir" },
        );
        return false;
      }
    },
    [fetchData, applyOptimisticWalletUpdate],
  );

  // Delete all installments in a group
  const deleteTransactionGroup = React.useCallback(
    async (transaction: Transaction): Promise<boolean> => {
      const transactionLabel = formatTransactionLabel(transaction);

      try {
        // If it's an installment, delete all in the group
        if (transaction.installmentGroupId) {
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
          applyOptimisticWalletUpdateBatch(
            groupTransactions.map((t) => ({
              oldTx: t,
              newTx: {
                ...t,
                status: "pending",
                extraCosts: t.extraCosts?.map((ec) => ({
                  ...ec,
                  status: "pending" as const,
                })),
              } as Transaction,
            })),
          );
          const groupIds = new Set(groupTransactions.map((t) => t.id));
          setTransactions((prev) => prev.filter((t) => !groupIds.has(t.id)));

          toast.success(
            `${groupTransactions.length} lancamentos vinculados a ${transactionLabel} foram excluidos com sucesso.`,
            { title: "Sucesso ao excluir" },
          );
        } else {
          // Single transaction
          await TransactionService.deleteTransaction(transaction.id);
          applyOptimisticWalletUpdate(transaction, {
            ...transaction,
            status: "pending",
            extraCosts: transaction.extraCosts?.map((ec) => ({
              ...ec,
              status: "pending" as const,
            })),
          } as Transaction);
          setTransactions((prev) =>
            prev.filter((t) => t.id !== transaction.id),
          );
          toast.success(
            `Lancamento ${transactionLabel} foi excluido com sucesso.`,
            { title: "Sucesso ao excluir" },
          );
        }

        // Refresh truth from server (background)
        await fetchData(true);

        return true;
      } catch (error) {
        console.error("Error deleting transaction group:", error);
        const errorMessage = getErrorMessage(
          error,
          "Falha inesperada ao excluir os lancamentos.",
        );
        toast.error(
          `Nao foi possivel excluir os lancamentos vinculados a ${transactionLabel}. Detalhes: ${errorMessage}`,
          { title: "Erro ao excluir" },
        );
        return false;
      }
    },
    [
      transactions,
      fetchData,
      applyOptimisticWalletUpdateBatch,
      applyOptimisticWalletUpdate,
    ],
  );

  // Update single transaction status
  const updateTransactionStatus = React.useCallback(
    async (
      transaction: Transaction,
      newStatus: Transaction["status"],
    ): Promise<boolean> => {
      const transactionLabel = formatTransactionLabel(transaction);

      try {
        await TransactionService.updateTransaction(transaction.id, {
          status: newStatus,
        });

        // Optimistic update
        applyOptimisticWalletUpdate(transaction, {
          ...transaction,
          status: newStatus,
        });
        setTransactions((prev) =>
          prev.map((t) =>
            t.id === transaction.id ? { ...t, status: newStatus } : t,
          ),
        );

        toast.success(
          `Status do lancamento ${transactionLabel} atualizado para "${newStatus}".`,
          { title: "Sucesso ao editar" },
        );

        // Refresh truth from server (background)
        await fetchData(true);

        return true;
      } catch (error) {
        console.error("Error updating transaction status:", error);
        const errorMessage = getErrorMessage(
          error,
          "Falha inesperada ao atualizar o status.",
        );
        toast.error(
          `Nao foi possivel atualizar o status do lancamento ${transactionLabel}. Detalhes: ${errorMessage}`,
          { title: "Erro ao editar" },
        );
        return false;
      }
    },
    [fetchData, applyOptimisticWalletUpdate],
  );

  // Generic update transaction
  const updateTransaction = React.useCallback(
    async (
      transaction: Transaction,
      data: Partial<Transaction>,
    ): Promise<boolean> => {
      const transactionLabel = formatTransactionLabel(transaction);

      try {
        await TransactionService.updateTransaction(transaction.id, data);

        // Optimistic update
        applyOptimisticWalletUpdate(transaction, { ...transaction, ...data });
        setTransactions((prev) =>
          prev.map((t) => (t.id === transaction.id ? { ...t, ...data } : t)),
        );

        toast.success(
          `Lancamento ${transactionLabel} atualizado com sucesso.`,
          {
            title: "Sucesso ao editar",
          },
        );

        // Refresh truth from server (background)
        await fetchData(true);

        return true;
      } catch (error) {
        console.error("Error updating transaction:", error);
        const errorMessage = getErrorMessage(
          error,
          "Falha inesperada ao editar o lancamento.",
        );
        toast.error(
          `Nao foi possivel editar o lancamento ${transactionLabel}. Detalhes: ${errorMessage}`,
          { title: "Erro ao editar" },
        );
        return false;
      }
    },
    [fetchData, applyOptimisticWalletUpdate],
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
        const updatesMap = new Map(updates.map((u) => [u.id, u.data]));
        const batchWalletUpdates = transactions
          .filter((t) => updatesMap.has(t.id))
          .map((t) => ({
            oldTx: t,
            newTx: { ...t, ...updatesMap.get(t.id) } as Transaction,
          }));
        applyOptimisticWalletUpdateBatch(batchWalletUpdates);

        setTransactions((prev) => {
          return prev.map((t) => {
            const update = updatesMap.get(t.id);
            return update ? { ...t, ...update } : t;
          });
        });

        toast.success(
          `${updates.length} lancamentos foram atualizados com sucesso.`,
          { title: "Sucesso ao editar" },
        );

        // Refresh truth from server (background)
        await fetchData(true);

        return true;
      } catch (error) {
        console.error("Error updating batch:", error);
        const errorMessage = getErrorMessage(
          error,
          "Falha inesperada ao editar os lancamentos.",
        );
        toast.error(
          `Nao foi possivel editar ${updates.length} lancamentos. Detalhes: ${errorMessage}`,
          { title: "Erro ao editar" },
        );
        return false;
      }
    },
    [fetchData, applyOptimisticWalletUpdateBatch, transactions],
  );

  // Update status for all installments in a group OR single
  const updateGroupStatus = React.useCallback(
    async (
      transaction: Transaction,
      newStatus: Transaction["status"],
      updateAll: boolean = true,
    ): Promise<boolean> => {
      const transactionLabel = formatTransactionLabel(transaction);

      try {
        // Check if this is a proposal group (has proposalGroupId)
        const hasProposalGroup = transaction.proposalGroupId && updateAll;

        // Check if this is an installment group
        const hasInstallmentGroup = transaction.installmentGroupId && updateAll;

        if (hasProposalGroup) {
          // Update all transactions in the proposal group (down payment + all installments)
          const groupTransactions = transactions.filter(
            (t) => t.proposalGroupId === transaction.proposalGroupId,
          );

          await TransactionService.updateTransactionsStatusBatch(
            groupTransactions.map((t) => t.id),
            newStatus,
          );

          // Update local state for all
          applyOptimisticWalletUpdateBatch(
            groupTransactions.map((t) => ({
              oldTx: t,
              newTx: { ...t, status: newStatus },
            })),
          );
          const groupIds = new Set(groupTransactions.map((t) => t.id));
          setTransactions((prev) =>
            prev.map((t) =>
              groupIds.has(t.id) ? { ...t, status: newStatus } : t,
            ),
          );

          toast.success(
            `${groupTransactions.length} lancamentos da proposta ${transactionLabel} tiveram status atualizado para "${newStatus}".`,
            { title: "Sucesso ao editar" },
          );
        } else if (hasInstallmentGroup) {
          // Update all installments in the installment group
          const groupTransactions = transactions.filter(
            (t) => t.installmentGroupId === transaction.installmentGroupId,
          );

          await TransactionService.updateTransactionsStatusBatch(
            groupTransactions.map((t) => t.id),
            newStatus,
          );

          // Update local state for all
          applyOptimisticWalletUpdateBatch(
            groupTransactions.map((t) => ({
              oldTx: t,
              newTx: { ...t, status: newStatus },
            })),
          );
          const groupIds = new Set(groupTransactions.map((t) => t.id));
          setTransactions((prev) =>
            prev.map((t) =>
              groupIds.has(t.id) ? { ...t, status: newStatus } : t,
            ),
          );

          toast.success(
            `${groupTransactions.length} parcelas de ${transactionLabel} tiveram status atualizado para "${newStatus}".`,
            { title: "Sucesso ao editar" },
          );
        } else {
          // Single transaction (or single installment update)
          await TransactionService.updateTransaction(transaction.id, {
            status: newStatus,
          });
          applyOptimisticWalletUpdate(transaction, {
            ...transaction,
            status: newStatus,
          });
          setTransactions((prev) =>
            prev.map((t) =>
              t.id === transaction.id ? { ...t, status: newStatus } : t,
            ),
          );
          toast.success(
            `Status do lancamento ${transactionLabel} atualizado para "${newStatus}".`,
            { title: "Sucesso ao editar" },
          );
        }

        // Refresh truth from server (background)
        await fetchData(true);

        return true;
      } catch (error) {
        console.error("Error updating status:", error);
        const errorMessage = getErrorMessage(
          error,
          "Falha inesperada ao atualizar o status.",
        );
        toast.error(
          `Nao foi possivel atualizar o status de ${transactionLabel}. Detalhes: ${errorMessage}`,
          { title: "Erro ao editar" },
        );
        return false;
      }
    },
    [
      transactions,
      fetchData,
      applyOptimisticWalletUpdateBatch,
      applyOptimisticWalletUpdate,
    ],
  );

  const updateExtraCostStatus = React.useCallback(
    async (
      parentTxId: string,
      ecId: string,
      newStatus: TransactionStatus,
    ): Promise<boolean> => {
      try {
        const parentTx = transactions.find((t) => t.id === parentTxId);
        if (!parentTx) throw new Error("Parent transaction not found");
        const parentLabel = formatTransactionLabel(parentTx);
        const targetExtraCost = (parentTx.extraCosts || []).find(
          (ec) => ec.id === ecId,
        );
        const extraCostLabel = targetExtraCost?.description?.trim()
          ? `"${targetExtraCost.description.trim()}"`
          : `ID ${ecId}`;

        const updatedExtraCosts = (parentTx.extraCosts || []).map((ec) =>
          ec.id === ecId ? { ...ec, status: newStatus } : ec,
        );

        await TransactionService.updateTransaction(parentTxId, {
          extraCosts: updatedExtraCosts,
        });

        // Optimistic update
        applyOptimisticWalletUpdate(parentTx, {
          ...parentTx,
          extraCosts: updatedExtraCosts,
        });

        setTransactions((prev) =>
          prev.map((t) =>
            t.id === parentTxId ? { ...t, extraCosts: updatedExtraCosts } : t,
          ),
        );

        toast.success(
          `Status do item extra ${extraCostLabel} em ${parentLabel} atualizado para "${newStatus}".`,
          { title: "Sucesso ao editar" },
        );

        await fetchData(true);
        return true;
      } catch (error) {
        console.error("Error updating extra cost status:", error);
        const errorMessage = getErrorMessage(
          error,
          "Falha inesperada ao atualizar o item extra.",
        );
        toast.error(
          `Nao foi possivel atualizar o item extra ${ecId}. Detalhes: ${errorMessage}`,
          { title: "Erro ao editar" },
        );
        return false;
      }
    },
    [transactions, applyOptimisticWalletUpdate, fetchData],
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

        // 1. Update original to be the PAID part (isPartialPayment = true)
        // This ensures the history/log shows this specific ID was paid
        await TransactionService.updateTransaction(originalTransaction.id, {
          amount: amount,
          status: "paid",
          date: date,
          isPartialPayment: true,
          // Keep installment info so it stays linked to the group
        });

        // 2. Create new transaction for the REMAINING part (Pending)
        // Explicitly remove ID to ensure clean creation
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _id, ...originalData } = originalTransaction;

        // CRITICAL FIX: The backend auto-generates installments if isInstallment=true AND installmentCount > 1 AND installmentNumber=1.
        // Since we are splitting Installment 1, we must avoid this auto-generation which creates duplicates (IDs 5,7,9,10 etc).
        // We temporarily set installmentCount to 1 to bypass creation logic, then update it back.

        // 2.1 Create with count 1
        const createResult = await TransactionService.createTransaction({
          ...originalData,
          amount: remainingAmount,
          status:
            originalTransaction.status === "paid"
              ? "pending"
              : originalTransaction.status,
          isPartialPayment: false, // This is the new "Main" one
          parentTransactionId: originalTransaction.id,
          installmentCount: 1, // Bypass backend recursion
          // Keep other metadata
        } as unknown as Omit<Transaction, "id">);

        // 2.2 Restore correct installment count if needed
        if (
          originalData.isInstallment &&
          (originalData.installmentCount || 0) > 1 &&
          createResult?.id
        ) {
          await TransactionService.updateTransaction(createResult.id, {
            installmentCount: originalData.installmentCount,
          });
        }

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
    updateExtraCostStatus,
    registerPartialPayment,
    refreshData: (background?: boolean) => fetchData(background),
    wallets,
  };
}
