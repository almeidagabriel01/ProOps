"use client";

import * as React from "react";
import {
  TransactionService,
  Transaction,
} from "@/services/transaction-service";
import { ProposalService, Proposal } from "@/services/proposal-service";
import { ClientService } from "@/services/client-service";
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
  financialSummary: FinancialSummary;
  wallets: Wallet[];
  totalClients: number;

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
  overdueAmount: number;
  upcomingDue: Transaction[];
  upcomingDueAmount: number;
  newClientsThisMonth: number;
  recentTransactions: Transaction[];
  recentProposals: Proposal[];
  balance: number;

  // Loading state
  isLoading: boolean;
}

const initialState: DashboardData = {
  transactions: [],
  wallets: [],
  totalClients: 0,
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
  overdueAmount: 0,
  upcomingDue: [],
  upcomingDueAmount: 0,
  newClientsThisMonth: 0,
  recentTransactions: [],
  recentProposals: [],
  balance: 0,
  isLoading: true,
};

/**
 * Conjuntos de status para as contagens server-side de propostas — espelha a
 * classificação por coluna do kanban usada na listagem (id OU mappedStatus da
 * coluna + statuses legados).
 */
function buildProposalStatusSets(columns: KanbanStatusColumn[]): {
  won: string[];
  open: string[];
} {
  const won = new Set<string>(["approved"]);
  const open = new Set<string>(["sent", "in_progress", "draft"]);
  columns.forEach((column) => {
    const target =
      column.category === "won" ? won : column.category === "open" ? open : null;
    if (!target) return;
    if (column.id) target.add(column.id);
    if (column.mappedStatus) target.add(column.mappedStatus);
  });
  return { won: Array.from(won), open: Array.from(open) };
}

export function useDashboardData(): DashboardData {
  const { tenant, isLoading: isTenantLoading, isDemo } = useTenant();
  const [rawData, setRawData] = React.useState({
    transactions: [] as Transaction[],
    wallets: [] as Wallet[],
    financialSummary: initialState.financialSummary,
    proposalStats: initialState.proposalStats,
    recentProposals: [] as Proposal[],
    totalClients: 0,
    newClientsThisMonth: 0,
  });
  const [isDataLoading, setIsDataLoading] = React.useState(true);

  // Fetch all data once. Propostas e clientes NÃO são mais baixados inteiros:
  // contagens via aggregation (count) + só as 5 propostas recentes.
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

    // Read-only demo mode: the demo tenant ("demo") now has seeded financial
    // docs (transactions/wallets), readable via the Firestore rules' isDemoRead
    // fast-path, so the dashboard loads them like any tenant. The only call that
    // doesn't work for the free role is the backend getSummary aggregation —
    // handled inline below (resolved to zeros, since no widget renders it).
    let cancelled = false;

    const fetchData = async () => {
      setIsDataLoading(true);
      try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        // Janela dos gráficos: mês atual até +12 meses (projeção do balanço
        // futuro). O escopo traz também TODOS os itens em aberto — projeção e
        // alertas não dependem da janela.
        const pad = (n: number) => String(n).padStart(2, "0");
        const isoDay = (d: Date) =>
          `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const horizonEnd = new Date(now.getFullYear(), now.getMonth() + 12, 0);

        const [
          scopedTransactions,
          paidThisMonth,
          recentTransactions,
          financialSummary,
          wallets,
          kanbanColumnsRaw,
          recentProposals,
          totalClients,
          newClientsThisMonth,
        ] = await Promise.all([
          TransactionService.getTransactionsScoped(tenant.id, {
            start: isoDay(monthStart),
            end: isoDay(horizonEnd),
          }),
          // Pago NESTE mês de lançamento antigo (date/dueDate fora da janela)
          // — entra no bucket do mês atual via paidAt.
          TransactionService.getTransactionsPaidBetween(
            tenant.id,
            monthStart.toISOString(),
            monthEnd.toISOString(),
          ),
          TransactionService.getRecentTransactions(tenant.id, 5),
          // getSummary hits the backend, which rejects the free/demo role. No
          // dashboard widget renders financialSummary today, so resolve zeros
          // for demo and keep the paying path unchanged.
          isDemo
            ? Promise.resolve(initialState.financialSummary)
            : TransactionService.getSummary(tenant.id),
          WalletService.getWallets(tenant.id),
          KanbanService.getStatuses(tenant.id),
          ProposalService.getRecentProposals(tenant.id, 5),
          ClientService.countClients(tenant.id),
          ClientService.countClientsCreatedBetween(tenant.id, monthStart, monthEnd),
        ]);

        const byId = new Map<string, Transaction>();
        for (const t of [...scopedTransactions, ...paidThisMonth, ...recentTransactions]) {
          if (!byId.has(t.id)) byId.set(t.id, t);
        }
        const transactions = Array.from(byId.values()).sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );

        const kanbanColumns =
          kanbanColumnsRaw.length > 0
            ? kanbanColumnsRaw
            : getDefaultProposalColumns().map(
                (c, i) => ({ ...c, id: `default_${i}` }) as KanbanStatusColumn,
              );

        // Contagens de proposta dependem das colunas do kanban (statuses dinâmicos)
        const statusSets = buildProposalStatusSets(kanbanColumns);
        const [approved, pending, allProposals, drafts] = await Promise.all([
          ProposalService.countProposalsByStatuses(tenant.id, statusSets.won),
          ProposalService.countProposalsByStatuses(tenant.id, statusSets.open),
          ProposalService.countProposals(tenant.id),
          ProposalService.countProposalsByStatuses(tenant.id, ["draft"]),
        ]);
        const total = Math.max(0, allProposals - drafts); // conversão exclui rascunhos
        const conversionRate = total > 0 ? Math.round((approved / total) * 100) : 0;

        if (!cancelled) {
          setRawData({
            transactions,
            financialSummary,
            wallets,
            proposalStats: { approved, pending, total, conversionRate },
            recentProposals,
            totalClients,
            newClientsThisMonth,
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
  }, [tenant, isTenantLoading, isDemo]);

  // Compute all derived values
  const computed = React.useMemo(() => {
    const { transactions, wallets } = rawData;
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

    const firstKey = Object.keys(futureBalancesMap)[0];
    forEachFinancialEntry((entry) => {
      if (entry.status === "paid" || !entry.dueDate) return;
      const date = parseDateValue(entry.dueDate);
      if (!date) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      // Overdue transactions (past dueDate) land in the current month
      const targetKey = futureBalancesMap[key] ? key : firstKey;
      if (entry.type === "income") futureBalancesMap[targetKey].income += entry.amount;
      else futureBalancesMap[targetKey].expense += entry.amount;
    });

    const futureBalances = Object.values(futureBalancesMap);
    const totalBalance = wallets
      .filter((w) => w.status === "active")
      .reduce((sum, w) => sum + w.balance, 0);

    let runningBalance = totalBalance;
    futureBalances.forEach((fb) => {
      runningBalance += fb.income - fb.expense;
      fb.balance = runningBalance;
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

    // Alerts
    const overdueTransactions = transactions.filter(
      (t) => t.status === "overdue"
    );
    const overdueAmount = overdueTransactions.reduce((sum, t) => sum + t.amount, 0);
    const upcomingDue = transactions.filter((t) => {
      if (t.status !== "pending" || !t.dueDate) return false;
      const dueDate = parseDateValue(t.dueDate);
      if (!dueDate) return false;
      const diffDays = Math.ceil(
        (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      return diffDays >= 0 && diffDays <= 7;
    });
    const upcomingDueAmount = upcomingDue.reduce((sum, t) => sum + t.amount, 0);

    return {
      wallets,
      chartData,
      futureBalances,
      currentMonthStats: {
        expensesByCategory: currentMonthExpensesByCategory,
        incomeByWallet: currentMonthIncomeByWallet,
        expensesByWallet: currentMonthExpensesByWallet,
      },
      overdueTransactions,
      overdueAmount,
      upcomingDue,
      upcomingDueAmount,
      recentTransactions: transactions.slice(0, 5),
      balance: totalBalance,
    };
  }, [rawData]);

  return {
    ...rawData,
    ...computed,
    isLoading: isDataLoading || isTenantLoading,
  };
}
