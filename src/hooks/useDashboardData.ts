"use client";

import * as React from "react";
import {
  TransactionService,
  Transaction,
} from "@/services/transaction-service";
import { ProposalService, Proposal } from "@/services/proposal-service";
import { ClientService, Client } from "@/services/client-service";
import { WalletService } from "@/services/wallet-service"; // Import WalletService
import { Wallet } from "@/types"; // Import Wallet type
import { KanbanService, KanbanStatusColumn, getDefaultProposalColumns } from "@/services/kanban-service";
import { useTenant } from "@/providers/tenant-provider";
import type { BarChartDataItem } from "@/components/charts/simple-bar-chart";
import { toast } from "@/lib/toast";
import { parseDateValue } from "@/utils/date-format";

interface FinancialSummary {
  totalIncome: number;
  totalExpense: number;
  pendingIncome: number;
  pendingExpense: number;
}

interface ProposalStats {
  approved: number;
  pending: number;
  total: number;
  conversionRate: number;
}

interface DashboardData {
  // Raw data
  transactions: Transaction[];
  proposals: Proposal[];
  clients: Client[];
  financialSummary: FinancialSummary;
  wallets: Wallet[];

  // Computed
  chartData: BarChartDataItem[];
  futureBalances: {
    month: string;
    monthYear: string;
    income: number;
    expense: number;
    balance: number;
  }[];
  currentMonthStats: {
    expensesByCategory: Record<string, number>;
    incomeByWallet: Record<string, number>;
    expensesByWallet: Record<string, number>;
  };
  proposalStats: ProposalStats;
  overdueTransactions: Transaction[];
  upcomingDue: Transaction[];
  newClientsThisMonth: number;
  recentTransactions: Transaction[];
  recentProposals: Proposal[];
  balance: number;

  // Loading state
  isLoading: boolean;
}

const initialState: DashboardData = {
  transactions: [],
  proposals: [],
  clients: [],
  wallets: [],
  financialSummary: {
    totalIncome: 0,
    totalExpense: 0,
    pendingIncome: 0,
    pendingExpense: 0,
  },
  chartData: [],
  futureBalances: [],
  currentMonthStats: {
    expensesByCategory: {},
    incomeByWallet: {},
    expensesByWallet: {},
  },
  proposalStats: { approved: 0, pending: 0, total: 0, conversionRate: 0 },
  overdueTransactions: [],
  upcomingDue: [],
  newClientsThisMonth: 0,
  recentTransactions: [],
  recentProposals: [],
  balance: 0,
  isLoading: true,
};

export function useDashboardData(): DashboardData {
  const { tenant, isLoading: isTenantLoading } = useTenant();
  const [rawData, setRawData] = React.useState({
    transactions: [] as Transaction[],
    proposals: [] as Proposal[],
    clients: [] as Client[],
    wallets: [] as Wallet[],
    kanbanColumns: [] as KanbanStatusColumn[],
    financialSummary: initialState.financialSummary,
  });
  const [isDataLoading, setIsDataLoading] = React.useState(true);

  // Fetch all data once
  React.useEffect(() => {
    // If tenant is still loading, wait
    if (isTenantLoading) {
      return;
    }

    // If tenant finished loading but is null (e.g., superadmin without tenant)
    // set loading to false and return empty data
    if (!tenant) {
      setIsDataLoading(false);
      return;
    }

    let cancelled = false;

    const fetchData = async () => {
      setIsDataLoading(true);
      try {
        const [transactions, proposals, clients, financialSummary, wallets, kanbanColumns] =
          await Promise.all([
            TransactionService.getTransactions(tenant.id),
            ProposalService.getProposals(tenant.id),
            ClientService.getClients(tenant.id),
            TransactionService.getSummary(tenant.id),
            WalletService.getWallets(tenant.id),
            KanbanService.getStatuses(tenant.id),
          ]);

        if (!cancelled) {
          setRawData({
            transactions,
            proposals,
            clients,
            financialSummary,
            wallets,
            kanbanColumns: kanbanColumns.length > 0 ? kanbanColumns : getDefaultProposalColumns().map((c, i) => ({ ...c, id: `default_${i}` } as KanbanStatusColumn)),
          });
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        if (!cancelled) {
          toast.error(
            "Não foi possível carregar os dados do painel. Verifique sua conexão.",
            { title: "Erro ao carregar" },
          );
        }
      } finally {
        if (!cancelled) {
          setIsDataLoading(false);
        }
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [tenant, isTenantLoading]);

  // Compute all derived values
  const computed = React.useMemo(() => {
    const { transactions, proposals, clients, wallets, kanbanColumns } =
      rawData;
    const now = new Date();
    const getEffectivePaidDate = (transaction: Transaction): string =>
      transaction.paidAt || transaction.updatedAt || transaction.date;

    const forEachFinancialEntry = (
      callback: (entry: {
        type: Transaction["type"];
        amount: number;
        status: Transaction["status"];
        date?: string;
        dueDate?: string;
        wallet?: string;
        category?: string;
      }) => void,
    ) => {
      transactions.forEach((transaction) => {
        callback({
          type: transaction.type,
          amount: transaction.amount,
          status: transaction.status,
          date: transaction.status === "paid"
            ? getEffectivePaidDate(transaction)
            : transaction.date,
          dueDate: transaction.dueDate || transaction.date,
          wallet: transaction.wallet,
          category: transaction.category,
        });

        (transaction.extraCosts || []).forEach((extraCost) => {
          callback({
            type: transaction.type,
            amount: extraCost.amount,
            status: extraCost.status || "pending",
            date:
              (extraCost.status || "pending") === "paid"
                ? getEffectivePaidDate(transaction)
                : extraCost.createdAt || transaction.date,
            dueDate: transaction.dueDate || transaction.date || extraCost.createdAt,
            wallet: extraCost.wallet || transaction.wallet,
            category: transaction.category,
          });
        });
      });
    };

    // Chart data - current month and next 5 months
    const months: {
      [key: string]: { receitas: number; despesas: number; name: string };
    } = {};
    for (let i = 0; i < 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      months[key] = {
        name: date
          .toLocaleDateString("pt-BR", { month: "short" })
          .replace(".", ""),
        receitas: 0,
        despesas: 0,
      };
    }
    forEachFinancialEntry((entry) => {
      // Use actual date for paid, dueDate for pending/overdue to project correctly
      const effectiveDateStr =
        entry.status === "paid" ? entry.date : (entry.dueDate || entry.date);
      if (!effectiveDateStr) return;
      
      const date = new Date(effectiveDateStr);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (months[key]) {
        if (entry.type === "income") months[key].receitas += entry.amount;
        else months[key].despesas += entry.amount;
      }
    });
    const chartData = Object.values(months);

    // Future Balances (Next 12 months including current)
    const futureBalancesMap: {
      [key: string]: {
        month: string;
        monthYear: string;
        income: number;
        expense: number;
        balance: number;
      };
    } = {};

    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      futureBalancesMap[key] = {
        month: date
          .toLocaleDateString("pt-BR", { month: "short" })
          .replace(".", ""),
        monthYear: key,
        income: 0,
        expense: 0,
        balance: 0,
      };
    }

    forEachFinancialEntry((entry) => {
      if (entry.status === "paid" || !entry.dueDate) return;
      const date = parseDateValue(entry.dueDate);
      if (!date) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      
      if (futureBalancesMap[key]) {
        if (entry.type === "income") futureBalancesMap[key].income += entry.amount;
        else futureBalancesMap[key].expense += entry.amount;
      }
    });

    const futureBalances = Object.values(futureBalancesMap);
    const totalBalance = wallets
      .filter((w) => w.status === "active")
      .reduce((sum, w) => sum + w.balance, 0);

    futureBalances.forEach((fb, index) => {
      if (index === 0) {
        fb.balance = totalBalance + fb.income - fb.expense;
      } else {
        fb.balance = fb.income - fb.expense;
      }
    });

    // Current Month Stats (Breakdown)
    const currentMonthExpensesByCategory: Record<string, number> = {};
    const currentMonthIncomeByWallet: Record<string, number> = {};
    const currentMonthExpensesByWallet: Record<string, number> = {};

    forEachFinancialEntry((entry) => {
      if (entry.status !== "paid") return;
      const date = parseDateValue(entry.date);
      if (!date) return;
      const isCurrentMonth =
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

      if (isCurrentMonth) {
        // Expenses by Category
        if (entry.type === "expense") {
          const category = entry.category || "Sem Categoria";
          currentMonthExpensesByCategory[category] =
            (currentMonthExpensesByCategory[category] || 0) + entry.amount;
        }

        // By Wallet
        const walletName = entry.wallet || "Sem Carteira";
        if (entry.type === "income") {
          currentMonthIncomeByWallet[walletName] =
            (currentMonthIncomeByWallet[walletName] || 0) + entry.amount;
        } else {
          currentMonthExpensesByWallet[walletName] =
            (currentMonthExpensesByWallet[walletName] || 0) + entry.amount;
        }
      }
    });

    // Proposal stats based on dynamic categories
    const approved = proposals.filter((p) => {
      if (p.status === "approved") return true; // Legacy
      const col = kanbanColumns.find(c => c.id === p.status || c.mappedStatus === p.status);
      return col?.category === "won";
    }).length;
    const pending = proposals.filter((p) => {
      if (p.status === "sent" || p.status === "in_progress") return true; // Legacy
      const col = kanbanColumns.find(c => c.id === p.status || c.mappedStatus === p.status);
      return col?.category === "open" || p.status === "draft";
    }).length;
    const total = proposals.filter(p => p.status !== "draft").length; // Exclude drafts from conversion rate
    const conversionRate = total > 0 ? Math.round((approved / total) * 100) : 0;

    // Alerts
    const overdueTransactions = transactions.filter(
      (t) => t.status === "overdue"
    );
    const upcomingDue = transactions.filter((t) => {
      if (t.status !== "pending" || !t.dueDate) return false;
      const dueDate = parseDateValue(t.dueDate);
      if (!dueDate) return false;
      const diffDays = Math.ceil(
        (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      return diffDays >= 0 && diffDays <= 7;
    });

    // New clients this month
    const newClientsThisMonth = clients.filter((c) => {
      const created = parseDateValue(c.createdAt);
      if (!created) return false;
      return (
        created.getMonth() === now.getMonth() &&
        created.getFullYear() === now.getFullYear()
      );
    }).length;

    return {
      wallets,
      chartData,
      futureBalances,
      currentMonthStats: {
        expensesByCategory: currentMonthExpensesByCategory,
        incomeByWallet: currentMonthIncomeByWallet,
        expensesByWallet: currentMonthExpensesByWallet,
      },
      proposalStats: { approved, pending, total, conversionRate },
      overdueTransactions,
      upcomingDue,
      newClientsThisMonth,
      recentTransactions: transactions.slice(0, 5),
      recentProposals: proposals.slice(0, 5),
      balance: totalBalance,
    };
  }, [rawData]);

  return {
    ...rawData,
    ...computed,
    isLoading: isDataLoading || isTenantLoading,
  };
}
