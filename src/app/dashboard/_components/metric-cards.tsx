"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertCircle,
} from "lucide-react";
import { formatCurrency } from "@/utils/format";

interface FinancialSummary {
  totalIncome: number;
  totalExpense: number;
  pendingIncome: number;
  pendingExpense: number;
}

interface FinancialMetricCardsProps {
  financialSummary: FinancialSummary;
  balance: number;
}

export function FinancialMetricCards({
  financialSummary,
  balance,
}: FinancialMetricCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Saldo Atual */}
      <Card className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${balance >= 0
        ? "border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-50/50 to-emerald-100/20 dark:from-emerald-950/20 dark:to-background border-emerald-200/50 dark:border-emerald-800/20"
        : "border-l-4 border-l-rose-500 bg-gradient-to-br from-rose-50/50 to-rose-100/20 dark:from-rose-950/20 dark:to-background border-rose-200/50 dark:border-rose-800/20"
        }`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between items-center">
            Saldo Atual
            <div className={`p-2.5 rounded-xl shadow-sm ${balance >= 0 ? "bg-emerald-500 text-white shadow-emerald-500/20" : "bg-rose-500 text-white shadow-rose-500/20"}`}>
              <Wallet className="h-4 w-4" />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
            {formatCurrency(balance)}
          </div>
          <p className="text-xs text-muted-foreground mt-1 font-medium">
            Receitas - Despesas pagas
          </p>
        </CardContent>
      </Card>

      {/* Receitas */}
      <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-l-4 border-l-emerald-500 bg-gradient-to-br from-background to-emerald-50/30 dark:to-emerald-950/10 hover:border-emerald-500/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between items-center">
            Receitas
            <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">
            {formatCurrency(financialSummary.totalIncome)}
          </div>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1 flex items-center gap-1">
            <TrendingUp size={12} /> Total recebido
          </p>
        </CardContent>
      </Card>

      {/* Despesas */}
      <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-l-4 border-l-rose-500 bg-gradient-to-br from-background to-rose-50/30 dark:to-rose-950/10 hover:border-rose-500/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between items-center">
            Despesas
            <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400">
              <TrendingDown className="h-4 w-4" />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">
            {formatCurrency(financialSummary.totalExpense)}
          </div>
          <p className="text-xs text-rose-600 dark:text-rose-400 font-medium mt-1 flex items-center gap-1">
            <TrendingDown size={12} /> Total pago
          </p>
        </CardContent>
      </Card>

      {/* Pendências */}
      <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-l-4 border-l-amber-500 bg-gradient-to-br from-background to-amber-50/30 dark:to-amber-950/10 hover:border-amber-500/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between items-center">
            Pendências
            <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
              <Clock className="h-4 w-4" />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">
            {formatCurrency(
              financialSummary.pendingIncome + financialSummary.pendingExpense
            )}
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-1">
            A receber + A pagar
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

interface AlertsCardProps {
  overdueCount: number;
  overdueAmount: number;
  upcomingDueCount: number;
  upcomingDueAmount: number;
}

export function AlertsCard({
  overdueCount,
  overdueAmount,
  upcomingDueCount,
  upcomingDueAmount,
}: AlertsCardProps) {
  if (overdueCount === 0 && upcomingDueCount === 0) return null;

  return (
    <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/50 rounded-xl p-4 flex flex-col md:flex-row items-center gap-4 shadow-sm backdrop-blur-sm">
      <div className="p-2.5 bg-orange-100 dark:bg-orange-900/50 rounded-full shrink-0">
        <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
      </div>
      <div className="flex-1 text-center md:text-left">
        <h3 className="font-semibold text-orange-900 dark:text-orange-100">Atenção Necessária</h3>
        <p className="text-sm text-orange-700/80 dark:text-orange-300/80">
          {overdueCount > 0
            ? `Você tem ${overdueCount} pagamento(s) atrasado(s) totalizando ${formatCurrency(overdueAmount)}.`
            : `Existem ${upcomingDueCount} pagamento(s) vencendo nos próximos 7 dias.`}
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        {overdueCount > 0 && (
          <div className="flex flex-col items-center">
            <Badge variant="destructive" className="px-3 py-1.5 text-sm shadow-sm hover:bg-destructive/90">
              {overdueCount} atrasado(s)
            </Badge>
            <span className="text-xs text-rose-600 dark:text-rose-400 font-medium mt-0.5">
              {formatCurrency(overdueAmount)}
            </span>
          </div>
        )}
        {upcomingDueCount > 0 && (
          <div className="flex flex-col items-center">
            <Badge className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 text-sm shadow-sm border-none">
              {upcomingDueCount} vencendo
            </Badge>
            <span className="text-xs text-orange-600 dark:text-orange-400 font-medium mt-0.5">
              {formatCurrency(upcomingDueAmount)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
