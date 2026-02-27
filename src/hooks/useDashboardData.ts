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
import { useTenant } from "@/providers/tenant-provider";
import type { BarChartDataItem } from "@/components/charts/simple-bar-chart";

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
        const [transactions, proposals, clients, financialSummary, wallets] =
          await Promise.all([
            TransactionService.getTransactions(tenant.id),
            ProposalService.getProposals(tenant.id),
            ClientService.getClients(tenant.id),
            TransactionService.getSummary(tenant.id),
            WalletService.getWallets(tenant.id),
          ]);

        if (!cancelled) {
          setRawData({
            transactions,
            proposals,
            clients,
            financialSummary,
            wallets,
          });
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
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
    const { transactions, proposals, clients, wallets } =
      rawData;
    const now = new Date();

    // Chart data - last 6 months
    const months: {
      [key: string]: { receitas: number; despesas: number; name: string };
    } = {};
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      months[key] = {
        name: date
          .toLocaleDateString("pt-BR", { month: "short" })
          .replace(".", ""),
        receitas: 0,
        despesas: 0,
      };
    }
    transactions.forEach((t) => {
      if (t.status !== "paid") return;
      const date = new Date(t.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (months[key]) {
        if (t.type === "income") months[key].receitas += t.amount;
        else months[key].despesas += t.amount;
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

    transactions.forEach((t) => {
      if (t.status === "paid" || !t.dueDate) return;
      const date = new Date(t.dueDate);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      
      if (futureBalancesMap[key]) {
        if (t.type === "income") futureBalancesMap[key].income += t.amount;
        else futureBalancesMap[key].expense += t.amount;
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

    transactions.forEach((t) => {
      if (t.status !== "paid") return;
      const date = new Date(t.date);
      const isCurrentMonth =
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

      if (isCurrentMonth) {
        // Expenses by Category
        if (t.type === "expense") {
          const category = t.category || "Sem Categoria";
          currentMonthExpensesByCategory[category] =
            (currentMonthExpensesByCategory[category] || 0) + t.amount;
        }

        // By Wallet
        const walletName = t.wallet || "Sem Carteira";
        if (t.type === "income") {
          currentMonthIncomeByWallet[walletName] =
            (currentMonthIncomeByWallet[walletName] || 0) + t.amount;
        } else {
          currentMonthExpensesByWallet[walletName] =
            (currentMonthExpensesByWallet[walletName] || 0) + t.amount;
        }
      }
    });

    // Proposal stats
    const approved = proposals.filter((p) => p.status === "approved").length;
    const pending = proposals.filter(
      (p) => p.status === "sent" || p.status === "draft"
    ).length;
    const total = proposals.length;
    const conversionRate = total > 0 ? Math.round((approved / total) * 100) : 0;

    // Alerts
    const overdueTransactions = transactions.filter(
      (t) => t.status === "overdue"
    );
    const upcomingDue = transactions.filter((t) => {
      if (t.status !== "pending" || !t.dueDate) return false;
      const dueDate = new Date(t.dueDate);
      const diffDays = Math.ceil(
        (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      return diffDays >= 0 && diffDays <= 7;
    });

    // New clients this month
    const newClientsThisMonth = clients.filter((c) => {
      const created = new Date(c.createdAt);
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
