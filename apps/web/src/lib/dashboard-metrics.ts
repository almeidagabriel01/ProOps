import type { Transaction } from "@/services/transaction-service";
import type { Wallet } from "@/types";
import type { BarChartDataItem } from "@/components/charts/simple-bar-chart";
import { parseDateValue } from "@/utils/date-format";

/**
 * Cálculos do dashboard, fora do hook para poderem ser testados e para o bloco
 * do mês escolhido reaproveitar a mesma regra do mês corrente.
 */

export interface MonthStats {
  expensesByCategory: Record<string, number>;
  incomeByWallet: Record<string, number>;
  expensesByWallet: Record<string, number>;
}

export interface FutureBalance {
  month: string;
  monthYear: string;
  income: number;
  expense: number;
  balance: number;
}

interface FinancialEntry {
  type: Transaction["type"];
  amount: number;
  status: Transaction["status"];
  date?: string;
  dueDate?: string;
  wallet?: string;
  category?: string;
}

const getEffectivePaidDate = (transaction: Transaction): string =>
  transaction.paidAt || transaction.updatedAt || transaction.date;

/** Lançamentos e seus custos extras, cada um com a data que conta para ele. */
function forEachFinancialEntry(
  transactions: Transaction[],
  callback: (entry: FinancialEntry) => void,
) {
  transactions.forEach((transaction) => {
    callback({
      type: transaction.type,
      amount: transaction.amount,
      status: transaction.status,
      date:
        transaction.status === "paid"
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
}

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

/** "2026-09" do mês da data, em hora local. */
export function toMonthKey(date: Date): string {
  return monthKey(date);
}

/**
 * O que foi PAGO no mês: despesas por categoria e movimento por carteira.
 * `month` no formato "YYYY-MM".
 */
export function computeMonthStats(
  transactions: Transaction[],
  month: string,
): MonthStats {
  const stats: MonthStats = {
    expensesByCategory: {},
    incomeByWallet: {},
    expensesByWallet: {},
  };

  forEachFinancialEntry(transactions, (entry) => {
    if (entry.status !== "paid") return;
    const date = parseDateValue(entry.date);
    if (!date || monthKey(date) !== month) return;

    if (entry.type === "expense") {
      const category = entry.category || "Sem Categoria";
      stats.expensesByCategory[category] =
        (stats.expensesByCategory[category] || 0) + entry.amount;
    }

    const walletName = entry.wallet || "Sem Carteira";
    const target =
      entry.type === "income" ? stats.incomeByWallet : stats.expensesByWallet;
    target[walletName] = (target[walletName] || 0) + entry.amount;
  });

  return stats;
}

/** Gráficos, saldo, alertas e recentes: tudo que depende da janela financeira. */
export function computeFinanceOverview(
  transactions: Transaction[],
  wallets: Wallet[],
  now: Date = new Date(),
) {
  // Chart data - current month and next 5 months
  const months: Record<string, { receitas: number; despesas: number; name: string }> = {};
  for (let i = 0; i < 6; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months[monthKey(date)] = {
      name: date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      receitas: 0,
      despesas: 0,
    };
  }
  forEachFinancialEntry(transactions, (entry) => {
    // Use actual date for paid, dueDate for pending/overdue to project correctly
    const effectiveDateStr =
      entry.status === "paid" ? entry.date : entry.dueDate || entry.date;
    if (!effectiveDateStr) return;
    const key = monthKey(new Date(effectiveDateStr));
    if (months[key]) {
      if (entry.type === "income") months[key].receitas += entry.amount;
      else months[key].despesas += entry.amount;
    }
  });
  const chartData: BarChartDataItem[] = Object.values(months);

  // Future Balances (Next 12 months including current)
  const futureBalancesMap: Record<string, FutureBalance> = {};
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const key = monthKey(date);
    futureBalancesMap[key] = {
      month: date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      monthYear: key,
      income: 0,
      expense: 0,
      balance: 0,
    };
  }
  const firstKey = Object.keys(futureBalancesMap)[0];
  forEachFinancialEntry(transactions, (entry) => {
    if (entry.status === "paid" || !entry.dueDate) return;
    const date = parseDateValue(entry.dueDate);
    if (!date) return;
    const key = monthKey(date);
    // Overdue transactions (past dueDate) land in the current month
    const targetKey = futureBalancesMap[key] ? key : firstKey;
    if (entry.type === "income") futureBalancesMap[targetKey].income += entry.amount;
    else futureBalancesMap[targetKey].expense += entry.amount;
  });

  const futureBalances = Object.values(futureBalancesMap);
  const balance = wallets
    .filter((w) => w.status === "active")
    .reduce((sum, w) => sum + w.balance, 0);

  let runningBalance = balance;
  futureBalances.forEach((fb) => {
    runningBalance += fb.income - fb.expense;
    fb.balance = runningBalance;
  });

  // Alerts
  const overdueTransactions = transactions.filter((t) => t.status === "overdue");
  const overdueAmount = overdueTransactions.reduce((sum, t) => sum + t.amount, 0);
  const upcomingDue = transactions.filter((t) => {
    if (t.status !== "pending" || !t.dueDate) return false;
    const dueDate = parseDateValue(t.dueDate);
    if (!dueDate) return false;
    const diffDays = Math.ceil(
      (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    return diffDays >= 0 && diffDays <= 7;
  });
  const upcomingDueAmount = upcomingDue.reduce((sum, t) => sum + t.amount, 0);

  return {
    chartData,
    futureBalances,
    balance,
    overdueTransactions,
    overdueAmount,
    upcomingDue,
    upcomingDueAmount,
    recentTransactions: transactions.slice(0, 5),
  };
}
