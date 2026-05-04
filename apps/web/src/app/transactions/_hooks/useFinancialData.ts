"use client";

import * as React from "react";
import { toast } from "@/lib/toast";
import {
  ExtraCost,
  Transaction,
  TransactionService,
  TransactionStatus,
} from "@/services/transaction-service";
import { WalletService } from "@/services/wallet-service";
import { useTenant } from "@/providers/tenant-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { Wallet } from "@/types";
import { statusConfig } from "../_constants/config";
import { ProposalService } from "@/services/proposal-service";
import { getProposalTransactionDisplayName } from "../_lib/proposal-transaction";
import {
  dateOnly,
  isDownPaymentLike,
  sameClient,
  baseDesc,
  getDateString,
  DateLike,
} from "../_lib/financial-utils";
import { normalize } from "@/utils/text";
import { useOptimisticWallets } from "./useOptimisticWallets";
import { useFinancialFilters } from "./useFinancialFilters";

const syncExtraCostsStatus = (
  extraCosts: ExtraCost[] | undefined,
  newStatus: TransactionStatus,
  oldParentStatus?: TransactionStatus,
): ExtraCost[] | undefined =>
  extraCosts?.map((extraCost) => {
    // Only sync extra costs that were aligned with the old parent status
    if (oldParentStatus && extraCost.status && extraCost.status !== oldParentStatus) {
      return extraCost;
    }
    return { ...extraCost, status: newStatus };
  });

const buildTransactionWithStatus = (
  transaction: Transaction,
  status: TransactionStatus,
): Transaction => ({
  ...transaction,
  status,
  extraCosts: syncExtraCostsStatus(transaction.extraCosts, status, transaction.status),
});

const buildNextTransactionState = (
  transaction: Transaction,
  data: Partial<Transaction>,
): Transaction => {
  const nextStatus =
    data.status && data.status !== transaction.status ? data.status : null;
  const nextExtraCosts =
    nextStatus !== null
      ? syncExtraCostsStatus(
          (data.extraCosts as ExtraCost[] | undefined) || transaction.extraCosts,
          nextStatus,
          transaction.status,
        )
      : ((data.extraCosts as ExtraCost[] | undefined) ?? transaction.extraCosts);

  return {
    ...transaction,
    ...data,
    ...(nextExtraCosts ? { extraCosts: nextExtraCosts } : {}),
  };
};

const matchesGroupByHeuristic = (
  orphan: Transaction,
  grouped: Transaction[],
): boolean => {
  if (!isDownPaymentLike(orphan)) return false;
  const matchingGroups = grouped.filter(
    (g) =>
      (!!g.installmentGroupId || !!g.recurringGroupId) &&
      !g.proposalGroupId &&
      g.type === orphan.type &&
      baseDesc(g.description || "") === baseDesc(orphan.description || "") &&
      sameClient(g, orphan) &&
      dateOnly(g.date) === dateOnly(orphan.date),
  );
  return matchingGroups.length === 1;
};

// Keep DateLike in scope for getErrorMessage (used in summary useMemo)
void (null as unknown as DateLike);
void matchesGroupByHeuristic;

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
};

const formatTransactionLabel = (
  transaction: Pick<Transaction, "id" | "description">,
): string => {
  const description = getProposalTransactionDisplayName(
    transaction as Pick<Transaction, "description" | "proposalId">,
  ).trim();
  return description ? `"${description}"` : `ID ${transaction.id}`;
};

const formatStatusLabel = (status: TransactionStatus): string =>
  (statusConfig[status]?.label || status).toLocaleLowerCase("pt-BR");

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
  filterType: import("@/services/transaction-service").TransactionType | "all";
  setFilterType: (type: import("@/services/transaction-service").TransactionType | "all") => void;
  filterStatus: TransactionStatus[];
  setFilterStatus: (status: TransactionStatus[]) => void;
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
  const [wallets, setWallets] = React.useState<Wallet[]>([]);
  const updatingIdsRef = React.useRef(new Set<string>());
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [serverSummary, setServerSummary] = React.useState<FinancialSummary>({
    totalIncome: 0,
    totalExpense: 0,
    pendingIncome: 0,
    pendingExpense: 0,
  });

  const {
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
  } = useFinancialFilters(transactions, wallets);

  const {
    applyOptimisticWalletUpdate,
    applyOptimisticWalletUpdateBatch,
  } = useOptimisticWallets(setWallets);

  const fetchData = React.useCallback(
    async (background = false) => {
      if (!tenant) {
        setTransactions([]);
        setWallets([]);
        if (!background) setIsLoading(false);
        return;
      }

      if (!hasFinancial && !isPlanLoading) {
        if (!background) setIsLoading(false);
        return;
      }

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
        if (!background) {
          toast.error(
            "Não foi possível carregar os dados financeiros. Verifique sua conexão e tente novamente.",
            { title: "Erro ao carregar" },
          );
        }
      } finally {
        if (!background) setIsLoading(false);
      }
    },
    [tenant, hasFinancial, isPlanLoading],
  );

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  React.useEffect(() => {
    return ProposalService.subscribe(() => {
      void fetchData(true);
    });
  }, [fetchData]);

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
      const mainTxMatchesWallet = !filterWallet || (() => {
        if (t.wallet === filterWallet) return true;
        const fwObj = wallets.find((w) => w.id === filterWallet || w.name === filterWallet);
        return !!fwObj && (t.wallet === fwObj.id || t.wallet === fwObj.name);
      })();
      const mainTxMatchesStatus =
        filterStatus.length === 0 || filterStatus.includes(t.status);

      let mainTxMatchesSearch = true;
      if (term) {
        const normalizedTerm = normalize(term);
        const displayName = getProposalTransactionDisplayName(
          t as Pick<Transaction, "description" | "proposalId">,
        );
        mainTxMatchesSearch =
          normalize(displayName).includes(normalizedTerm) ||
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

          if (filterWallet) {
            const fwObj = wallets.find((w) => w.id === filterWallet || w.name === filterWallet);
            const ecMatches = ecWallet === filterWallet || (!!fwObj && (ecWallet === fwObj.id || ecWallet === fwObj.name));
            if (!ecMatches) return;
          }
          if (filterStatus.length > 0 && !filterStatus.includes(ecStatus as TransactionStatus)) return;

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
    wallets,
    filterWallet,
    filterType,
    filterStatus,
    searchTerm,
    filterDateType,
    filterStartDate,
    filterEndDate,
  ]);

  // Delete a single transaction (individual installment)
  const deleteTransaction = React.useCallback(
    async (transaction: Transaction): Promise<boolean> => {
      const transactionLabel = formatTransactionLabel(transaction);

      try {
        await TransactionService.deleteTransaction(transaction.id);

        // Optimistic update
        applyOptimisticWalletUpdate(transaction, undefined);
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
          "Falha inesperada ao excluir o lançamento.",
        );
        toast.error(
          `Não foi possível excluir o lançamento ${transactionLabel}. Detalhes: ${errorMessage}`,
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
      const groupId = transaction.installmentGroupId || transaction.recurringGroupId;
      // Lock on the group ID (or the single transaction ID) to prevent double-click races.
      const lockKey = groupId || transaction.id;
      if (updatingIdsRef.current.has(lockKey)) return false;
      updatingIdsRef.current.add(lockKey);

      const transactionLabel = formatTransactionLabel(transaction);

      try {
        if (groupId) {
          const groupTransactions = transactions.filter(
            (t) => (t.installmentGroupId || t.recurringGroupId) === groupId,
          );

          await TransactionService.deleteTransactionGroup(groupId);

          // Batch optimistic update: single setWallets call = single re-render (BUG-9).
          // Pass newTx with no wallet so calculateWalletImpacts returns 0 for it,
          // effectively reverting only the paid transactions' wallet impact.
          applyOptimisticWalletUpdateBatch(
            groupTransactions.map((t) => ({
              oldTx: t,
              newTx: { ...t, wallet: undefined, status: "pending" as TransactionStatus },
            })),
          );
          const groupIds = new Set(groupTransactions.map((t) => t.id));
          setTransactions((prev) => prev.filter((t) => !groupIds.has(t.id)));

          toast.success(
            `${groupTransactions.length} lançamentos vinculados a ${transactionLabel} foram excluídos com sucesso.`,
            { title: "Sucesso ao excluir" },
          );
        } else {
          // Single transaction
          await TransactionService.deleteTransaction(transaction.id);
          applyOptimisticWalletUpdate(transaction, undefined);
          setTransactions((prev) => prev.filter((t) => t.id !== transaction.id));
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
          "Falha inesperada ao excluir os lançamentos.",
        );
        toast.error(
          `Não foi possível excluir os lançamentos vinculados a ${transactionLabel}. Detalhes: ${errorMessage}`,
          { title: "Erro ao excluir" },
        );
        return false;
      } finally {
        updatingIdsRef.current.delete(lockKey);
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
      if (updatingIdsRef.current.has(transaction.id)) return false;
      updatingIdsRef.current.add(transaction.id);
      const transactionLabel = formatTransactionLabel(transaction);

      try {
        await TransactionService.updateTransaction(transaction.id, {
          status: newStatus,
        });

        const nextTransaction = buildTransactionWithStatus(transaction, newStatus);

        // Optimistic update
        applyOptimisticWalletUpdate(transaction, nextTransaction);
        setTransactions((prev) =>
          prev.map((t) =>
            t.id === transaction.id ? nextTransaction : t,
          ),
        );

        toast.success(
          `Status do lançamento ${transactionLabel} atualizado para "${formatStatusLabel(newStatus)}".`,
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
          `Não foi possível atualizar o status do lançamento ${transactionLabel}. Detalhes: ${errorMessage}`,
          { title: "Erro ao editar" },
        );
        return false;
      } finally {
        updatingIdsRef.current.delete(transaction.id);
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
      if (updatingIdsRef.current.has(transaction.id)) return false;
      updatingIdsRef.current.add(transaction.id);
      const transactionLabel = formatTransactionLabel(transaction);

      try {
        await TransactionService.updateTransaction(transaction.id, data);

        const nextTransaction = buildNextTransactionState(transaction, data);

        // Optimistic update
        applyOptimisticWalletUpdate(transaction, nextTransaction);
        setTransactions((prev) =>
          prev.map((t) => (t.id === transaction.id ? nextTransaction : t)),
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
          "Falha inesperada ao editar o lançamento.",
        );
        toast.error(
          `Não foi possível editar o lançamento ${transactionLabel}. Detalhes: ${errorMessage}`,
          { title: "Erro ao editar" },
        );
        return false;
      } finally {
        updatingIdsRef.current.delete(transaction.id);
      }
    },
    [fetchData, applyOptimisticWalletUpdate],
  );

  // Batch update transactions — single atomic backend call (no partial failures)
  const updateBatchTransactions = React.useCallback(
    async (
      updates: { id: string; data: Partial<Transaction> }[],
    ): Promise<boolean> => {
      if (updates.some((u) => updatingIdsRef.current.has(u.id))) return false;
      updates.forEach((u) => updatingIdsRef.current.add(u.id));
      try {
        await TransactionService.updateTransactionsBatch(updates);

        const updatesMap = new Map(updates.map((u) => [u.id, u.data]));
        const batchWalletUpdates = transactions
          .filter((t) => updatesMap.has(t.id))
          .map((t) => ({
            oldTx: t,
            newTx: buildNextTransactionState(t, updatesMap.get(t.id) as Partial<Transaction>),
          }));
        applyOptimisticWalletUpdateBatch(batchWalletUpdates);

        setTransactions((prev) =>
          prev.map((t) => {
            const update = updatesMap.get(t.id);
            return update ? buildNextTransactionState(t, update) : t;
          }),
        );

        toast.success(`${updates.length} lançamentos foram atualizados com sucesso.`, {
          title: "Sucesso ao editar",
        });

        await fetchData(true);
        return true;
      } catch (error) {
        console.error("Error updating batch:", error);
        const errorMessage = getErrorMessage(error, "Falha inesperada ao editar os lançamentos.");
        toast.error(`Não foi possível editar ${updates.length} lançamentos. Detalhes: ${errorMessage}`, {
          title: "Erro ao editar",
        });
        return false;
      } finally {
        updates.forEach((u) => updatingIdsRef.current.delete(u.id));
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
      if (updatingIdsRef.current.has(transaction.id)) return false;
      updatingIdsRef.current.add(transaction.id);
      const transactionLabel = formatTransactionLabel(transaction);

      try {
        // Check if this is a proposal group (has proposalGroupId)
        const hasProposalGroup = transaction.proposalGroupId && updateAll;

        // Check if this is an installment or recurring group
        const hasInstallmentGroup =
          (transaction.installmentGroupId || transaction.recurringGroupId) &&
          updateAll;

        if (hasProposalGroup || hasInstallmentGroup) {
          // Use the authoritative group ID — server will discover all members,
          // including ones added from other tabs after our local state was loaded (BUG-12).
          const groupId =
            transaction.proposalGroupId ||
            transaction.installmentGroupId ||
            transaction.recurringGroupId;

          await TransactionService.updateGroupStatus(groupId!, newStatus);

          // Optimistic local update based on what we know locally.
          // Background refresh below will reconcile any server-discovered extras.
          const localGroupTransactions = transactions.filter(
            (t) =>
              (hasProposalGroup && t.proposalGroupId === transaction.proposalGroupId) ||
              (hasInstallmentGroup &&
                (t.installmentGroupId || t.recurringGroupId) ===
                  (transaction.installmentGroupId || transaction.recurringGroupId)),
          );

          applyOptimisticWalletUpdateBatch(
            localGroupTransactions.map((t) => ({
              oldTx: t,
              newTx: buildTransactionWithStatus(t, newStatus),
            })),
          );
          const groupIds = new Set(localGroupTransactions.map((t) => t.id));
          setTransactions((prev) =>
            prev.map((t) => (groupIds.has(t.id) ? buildTransactionWithStatus(t, newStatus) : t)),
          );

          toast.success(
            `${localGroupTransactions.length} lançamentos de ${transactionLabel} tiveram status atualizado para "${formatStatusLabel(newStatus)}".`,
            { title: "Sucesso ao editar" },
          );
        } else {
          // Single transaction (or single installment update)
          await TransactionService.updateTransaction(transaction.id, {
            status: newStatus,
          });
          const nextTransaction = buildTransactionWithStatus(
            transaction,
            newStatus,
          );
          applyOptimisticWalletUpdate(transaction, nextTransaction);
          setTransactions((prev) =>
            prev.map((t) =>
              t.id === transaction.id ? nextTransaction : t,
            ),
          );
          toast.success(
            `Status do lançamento ${transactionLabel} atualizado para "${formatStatusLabel(newStatus)}".`,
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
          `Não foi possível atualizar o status de ${transactionLabel}. Detalhes: ${errorMessage}`,
          { title: "Erro ao editar" },
        );
        return false;
      } finally {
        updatingIdsRef.current.delete(transaction.id);
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
      const lockKey = `${parentTxId}:${ecId}`;
      if (updatingIdsRef.current.has(lockKey)) return false;
      updatingIdsRef.current.add(lockKey);
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
          `Status do item extra ${extraCostLabel} em ${parentLabel} atualizado para "${formatStatusLabel(newStatus)}".`,
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
          `Não foi possível atualizar o item extra ${ecId}. Detalhes: ${errorMessage}`,
          { title: "Erro ao editar" },
        );
        return false;
      } finally {
        updatingIdsRef.current.delete(lockKey);
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
        await TransactionService.registerPartialPayment(originalTransaction.id, amount, date);
        toast.success("Pagamento parcial registrado com sucesso!");
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
