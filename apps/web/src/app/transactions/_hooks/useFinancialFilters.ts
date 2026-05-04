"use client";

import * as React from "react";
import type {
  Transaction,
  TransactionType,
  TransactionStatus,
} from "@/services/transaction-service";
import type { Wallet } from "@/types";
import { normalize } from "@/utils/text";
import { getProposalTransactionDisplayName } from "../_lib/proposal-transaction";
import {
  isDownPaymentLike,
  dateOnly,
  sameClient,
  baseDesc,
  aggregateExtraCosts,
  getGroupedTransactionKey,
  getDateString,
} from "../_lib/financial-utils";

export function useFinancialFilters(
  transactions: Transaction[],
  wallets: Wallet[],
) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [filterType, setFilterType] = React.useState<TransactionType | "all">(
    "all",
  );
  const [filterStatus, setFilterStatus] = React.useState<TransactionStatus[]>([
    "pending",
  ]);
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
              rowKey: `extra:${t.id}:${ec.id}`,
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
              extraCosts: aggregateExtraCosts(proposalGroup),
            };

            effectiveTransactions.push(representative);
            processedProposalGroups.add(t.proposalGroupId);

            // Also mark the installmentGroupId as processed to avoid duplicates
            const installmentGroupIds = proposalGroup
              .filter((g) => g.installmentGroupId || g.recurringGroupId)
              .map((g) => (g.installmentGroupId || g.recurringGroupId)!);
            installmentGroupIds.forEach((id) =>
              processedInstallmentGroups.add(id),
            );
          }
          return;
        }

        // CASE 2: Transaction is part of an installment or recurring group (without proposal group)
        // This includes both regular installments AND down payments (isDownPayment = true)
        const groupId = t.installmentGroupId || t.recurringGroupId;
        if (groupId) {
          if (processedInstallmentGroups.has(groupId)) return;

          // Find all belonging to this group (both installments and down payments)
          const group = transactions.filter(
            (g) => (g.installmentGroupId || g.recurringGroupId) === groupId,
          );
          const groupWithOrphans = [...group];
          const orphanDownPayments = transactions.filter(
            (candidate) =>
              !candidate.installmentGroupId &&
              !candidate.recurringGroupId &&
              !candidate.proposalGroupId &&
              isDownPaymentLike(candidate) &&
              candidate.id !== t.id &&
              candidate.type === t.type &&
              baseDesc(candidate.description || "") ===
                baseDesc(t.description || "") &&
              sameClient(candidate, t) &&
              dateOnly(candidate.date) === dateOnly(t.date),
          );
          if (orphanDownPayments.length === 1) {
            groupWithOrphans.push(orphanDownPayments[0]);
          }

          // Sort group: down payment first (explicit flag or installmentNumber 0), then by installment number
          groupWithOrphans.sort((a, b) => {
            const aIsDown = isDownPaymentLike(a);
            const bIsDown = isDownPaymentLike(b);
            if (aIsDown && !bIsDown) return -1;
            if (!aIsDown && bIsDown) return 1;
            return (a.installmentNumber || 0) - (b.installmentNumber || 0);
          });

          // Find the first "pending" or "overdue" item (not paid)
          let active = groupWithOrphans.find((g) => g.status !== "paid");

          // If all are paid, show the last one
          if (!active && groupWithOrphans.length > 0) {
            active = groupWithOrphans[groupWithOrphans.length - 1];
          }

          // If for some reason we didn't find one (empty group?), skip
          if (active) {
            const hasTrueInstallments = groupWithOrphans.some(
              (g) => g.isInstallment && !g.isDownPayment,
            );
            // For installment groups: anchor on the down payment (installmentNumber 0 is stable).
            // For simple groups (down payment + main tx only): anchor on the main tx so the
            // card shows the correct total amount and metadata instead of the entrada's data.
            // Uses the explicit isDownPayment flag — not the heuristic — to find the main tx.
            const stableAnchor = hasTrueInstallments
              ? (groupWithOrphans.find((g) => isDownPaymentLike(g)) || groupWithOrphans[0])
              : (groupWithOrphans.find((g) => !g.isDownPayment) || groupWithOrphans[0]);
            const groupedSource = group[0] || active;
            let aggregateStatus: Transaction["status"] = "paid";
            if (groupWithOrphans.some((g) => g.status === "overdue")) {
              aggregateStatus = "overdue";
            } else if (groupWithOrphans.some((g) => g.status === "pending")) {
              aggregateStatus = "pending";
            }
            const representative: Transaction = {
              ...stableAnchor,
              isInstallment:
                groupedSource.isInstallment ?? stableAnchor.isInstallment,
              isRecurring: groupedSource.isRecurring ?? stableAnchor.isRecurring,
              installmentCount:
                groupedSource.installmentCount ?? stableAnchor.installmentCount,
              installmentInterval:
                groupedSource.installmentInterval ??
                stableAnchor.installmentInterval,
              installmentGroupId:
                groupedSource.installmentGroupId ??
                stableAnchor.installmentGroupId,
              recurringGroupId:
                groupedSource.recurringGroupId ?? stableAnchor.recurringGroupId,
              status: aggregateStatus,
              extraCosts: aggregateExtraCosts(groupWithOrphans),
              createdAt: stableAnchor?.createdAt || active.createdAt,
            };

            effectiveTransactions.push(representative);
            processedInstallmentGroups.add(groupId);
          }
          return;
        }
      });

      // === PASS 2: Process standalone transactions and orphan down payments ===
      // Now effectiveTransactions contains ALL group representatives,
      // so heuristic matching can correctly find them.
      sortedRaw.forEach((t) => {
        // Skip already-processed grouped transactions
        if (t.proposalGroupId || t.installmentGroupId || t.recurringGroupId)
          return;

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

    let filtered =
      viewMode === "grouped"
        ? (() => {
            const uniqueTransactions = new Map<string, Transaction>();
            effectiveTransactions.forEach((transaction) => {
              const key = getGroupedTransactionKey(transaction);
              if (!uniqueTransactions.has(key)) {
                uniqueTransactions.set(key, transaction);
              }
            });
            return Array.from(uniqueTransactions.values());
          })()
        : effectiveTransactions;

    // Filter by type
    if (filterType !== "all") {
      filtered = filtered.filter((t) => t.type === filterType);
    }

    // Filter by status (multi-select; empty array = no filter)
    if (filterStatus.length > 0) {
      filtered = filtered.filter((t) => {
        if (filterStatus.includes(t.status)) return true;
        // In byDueDate mode, extra costs are already own rows — don't double-match via parent
        if (
          viewMode !== "byDueDate" &&
          t.extraCosts &&
          t.extraCosts.some((ec) =>
            filterStatus.includes((ec.status || "pending") as TransactionStatus),
          )
        )
          return true;
        return false;
      });
    }

    // Filter by wallet (supports both wallet ID and legacy wallet NAME)
    if (filterWallet) {
      const filterWalletObj = wallets.find((w) => w.id === filterWallet || w.name === filterWallet);
      const matchesWallet = (walletField: string | undefined | null): boolean => {
        if (!walletField) return false;
        if (walletField === filterWallet) return true;
        if (filterWalletObj && (walletField === filterWalletObj.id || walletField === filterWalletObj.name)) return true;
        return false;
      };
      filtered = filtered.filter((t) => {
        if (matchesWallet(t.wallet)) return true;
        // In byDueDate mode, extra costs are already own rows — don't double-match via parent
        if (
          viewMode !== "byDueDate" &&
          t.extraCosts &&
          t.extraCosts.some((ec) => matchesWallet(ec.wallet || t.wallet))
        )
          return true;
        return false;
      });
    }

    // Filter by date range
    if (filterStartDate || filterEndDate) {
      filtered = filtered.filter((t) => {
        // For installment/recurring transactions in GROUPED mode, check if ANY in the group matches the date range
        if (
          viewMode === "grouped" &&
          filterDateType === "dueDate" &&
          (t.installmentGroupId || t.recurringGroupId)
        ) {
          const groupId = t.installmentGroupId || t.recurringGroupId;
          // Get all elements in this group
          const group = transactions.filter(
            (g) => (g.installmentGroupId || g.recurringGroupId) === groupId,
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
      filtered = filtered.filter((t) => {
        const displayName = getProposalTransactionDisplayName(
          t as Pick<Transaction, "description" | "proposalId">,
        );
        return (
          normalize(displayName).includes(term) ||
          normalize(t.clientName || "").includes(term) ||
          normalize(t.category || "").includes(term) ||
          normalize(t.wallet || "").includes(term) ||
          (t.extraCosts &&
            t.extraCosts.some(
              (ec) =>
                normalize(ec.description).includes(term) ||
                normalize(ec.wallet || "").includes(term),
            ))
        );
      });
    }

    // Sort
    if (viewMode === "byDueDate") {
      // In byDueDate mode, always sort by due date (closest first)
      return filtered.sort((a, b) => {
        const getDueDateMs = (t: Transaction) => {
          if (!t.dueDate) return Infinity; // Items without due date go to the end
          const dateStr = getDateString(t.dueDate);
          if (!dateStr) return Infinity;
          return new Date(dateStr + "T12:00:00").getTime();
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const getMillis = (val: any) => {
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
    wallets,
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

  const totalWalletBalance = React.useMemo(() => {
    return wallets
      .filter((w) => {
        const isActive = w.status === "active";
        const matchesFilter = filterWallet
          ? w.id === filterWallet || w.name === filterWallet
          : true;
        return isActive && matchesFilter;
      })
      .reduce((sum, w) => sum + w.balance, 0);
  }, [wallets, filterWallet]);

  return {
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
  };
}

// Local helper used only inside filteredTransactions
function matchesGroupByHeuristic(
  orphan: Transaction,
  grouped: Transaction[],
): boolean {
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
}

