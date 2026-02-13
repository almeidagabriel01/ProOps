"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { formatCurrency } from "@/utils/format";
import * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";

interface MonthStatsProps {
  currentMonthStats: {
    expensesByCategory: Record<string, number>;
    incomeByWallet: Record<string, number>;
    expensesByWallet: Record<string, number>;
  };
}

export function MonthStats({ currentMonthStats }: MonthStatsProps) {
  const { expensesByCategory, incomeByWallet, expensesByWallet } =
    currentMonthStats;

  // Convert objects to arrays for rendering
  const expenseCategories = Object.entries(expensesByCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5); // Top 5 categories

  const walletActivity = Array.from(
    new Set([...Object.keys(incomeByWallet), ...Object.keys(expensesByWallet)]),
  ).sort();

  const totalExpense = Object.values(expensesByCategory).reduce(
    (a, b) => a + b,
    0,
  );

  return (
    <div className="grid gap-6 grid-cols-1">
      {/* Categories Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Despesas por Categoria</CardTitle>
          <CardDescription>Principais gastos deste mês</CardDescription>
        </CardHeader>
        <CardContent>
          {expenseCategories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <LucideIcons.PieChart className="w-10 h-10 mb-2 opacity-20" />
              <p>Nenhuma despesa registrada este mês</p>
            </div>
          ) : (
            <div className="space-y-4">
              {expenseCategories.map(([category, amount]) => {
                const percentage =
                  totalExpense > 0 ? (amount / totalExpense) * 100 : 0;
                return (
                  <div key={category} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{category}</span>
                      <span className="text-muted-foreground">
                        {formatCurrency(amount)} ({percentage.toFixed(0)}%)
                      </span>
                    </div>
                    {/* Custom Progress Bar */}
                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-rose-500 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Wallet Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Movimentação por Carteira</CardTitle>
          <CardDescription>Entradas e saídas deste mês</CardDescription>
        </CardHeader>
        <CardContent>
          {walletActivity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <LucideIcons.ArrowRightLeft className="w-10 h-10 mb-2 opacity-20" />
              <p>Nenhuma movimentação registrada este mês</p>
            </div>
          ) : (
            <div className="space-y-4">
              {walletActivity.map((walletName) => {
                const income = incomeByWallet[walletName] || 0;
                const expense = expensesByWallet[walletName] || 0;
                const balance = income - expense;

                return (
                  <div
                    key={walletName}
                    className="flex items-center justify-between py-2 border-b last:border-0 border-border/40"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                        <LucideIcons.Wallet className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{walletName}</p>
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          {income > 0 && (
                            <span className="text-emerald-500">
                              + {formatCurrency(income)}
                            </span>
                          )}
                          {expense > 0 && (
                            <span className="text-rose-500">
                              - {formatCurrency(expense)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div
                      className={cn(
                        "font-semibold text-sm",
                        balance > 0
                          ? "text-emerald-600"
                          : balance < 0
                            ? "text-rose-600"
                            : "text-muted-foreground",
                      )}
                    >
                      {balance > 0 ? "+" : ""}
                      {formatCurrency(balance)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
