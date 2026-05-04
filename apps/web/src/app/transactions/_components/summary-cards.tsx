"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  AlertCircle,
  Wallet,
} from "lucide-react";
import { formatCurrency } from "@/utils/format";

interface FinancialSummary {
  totalIncome: number;
  totalExpense: number;
  pendingIncome: number;
  pendingExpense: number;
}

interface SelectionSummary {
  count: number;
  paidIncome: number;
  paidExpense: number;
  pendingIncome: number;
  pendingExpense: number;
}

interface FinancialSummaryCardsProps {
  summary: FinancialSummary;
  selectionSummary?: SelectionSummary;
  balance?: number;
}

export function FinancialSummaryCards({
  summary,
  selectionSummary,
  balance,
}: FinancialSummaryCardsProps) {
  const hasSelection = selectionSummary && selectionSummary.count > 0;

  // Use selection values if there's a selection, otherwise use full summary
  const displayValues = hasSelection
    ? {
        totalIncome: selectionSummary.paidIncome,
        totalExpense: selectionSummary.paidExpense,
        pendingIncome: selectionSummary.pendingIncome,
        pendingExpense: selectionSummary.pendingExpense,
      }
    : summary;

  // Calculate balance value
  const balanceValue =
    (typeof balance !== "undefined" ? balance : 0) +
    displayValues.pendingIncome -
    displayValues.pendingExpense;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Primary Cards: Full Height */}

      {/* A Receber */}
      <Card
        className={`relative overflow-hidden flex flex-col justify-between ${hasSelection ? "ring-2 ring-primary/20" : ""}`}
      >
        <div className="absolute top-0 right-0 p-3 opacity-10">
          <Clock className="h-24 w-24 text-yellow-500" />
        </div>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 relative z-10">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              A Receber
            </CardTitle>
            {hasSelection && (
              <Badge variant="secondary" className="text-[10px] h-5">
                {selectionSummary.count} sel.
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="relative z-10 pb-4">
          <div className="text-2xl font-bold text-yellow-500">
            {formatCurrency(displayValues.pendingIncome)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Previsão de entrada
          </p>
        </CardContent>
      </Card>

      {/* A Pagar */}
      <Card
        className={`relative overflow-hidden flex flex-col justify-between ${hasSelection ? "ring-2 ring-primary/20" : ""}`}
      >
        <div className="absolute top-0 right-0 p-3 opacity-10">
          <AlertCircle className="h-24 w-24 text-orange-500" />
        </div>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 relative z-10">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              A Pagar
            </CardTitle>
            {hasSelection && (
              <Badge variant="secondary" className="text-[10px] h-5">
                {selectionSummary.count} sel.
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="relative z-10 pb-4">
          <div className="text-2xl font-bold text-orange-500">
            {formatCurrency(displayValues.pendingExpense)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Previsão de saída
          </p>
        </CardContent>
      </Card>

      {/* Balance Card - Projected */}
      {typeof balance !== "undefined" && (
        <Card className="relative overflow-hidden border-blue-500/20 bg-blue-500/5 flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <Wallet className="h-24 w-24 text-blue-500" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 relative z-10">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium text-blue-600">
                Balanço Previsto
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="relative z-10 pb-4">
            <div
              className={`text-2xl font-bold ${
                balanceValue >= 0 ? "text-blue-600" : "text-red-500"
              }`}
            >
              {formatCurrency(balanceValue)}
            </div>
            <p className="text-xs text-blue-600/80 mt-1">
              Considerando pendências
            </p>
          </CardContent>
        </Card>
      )}

      {/* Secondary Cards Column: Receitas Recebidas, Despesas Pagas */}
      <div className="flex flex-col gap-3">
        {/* Receitas Recebidas */}
        <Card
          className={`flex-1 flex flex-col justify-center bg-muted/30 border-dashed ${hasSelection ? "ring-2 ring-primary/20" : ""}`}
        >
          <div className="flex flex-row items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Receitas Recebidas
              </CardTitle>
              {hasSelection && (
                <Badge variant="secondary" className="text-[10px] h-5">
                  {selectionSummary.count} sel.
                </Badge>
              )}
            </div>
            <TrendingUp className="h-4 w-4 text-green-500/70" />
          </div>
          <div className="px-4 pb-2">
            <div className="text-lg font-semibold text-green-600/90">
              {formatCurrency(displayValues.totalIncome)}
            </div>
          </div>
        </Card>

        {/* Despesas Pagas */}
        <Card
          className={`flex-1 flex flex-col justify-center bg-muted/30 border-dashed ${hasSelection ? "ring-2 ring-primary/20" : ""}`}
        >
          <div className="flex flex-row items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Despesas Pagas
              </CardTitle>
              {hasSelection && (
                <Badge variant="secondary" className="text-[10px] h-5">
                  {selectionSummary.count} sel.
                </Badge>
              )}
            </div>
            <TrendingDown className="h-4 w-4 text-red-500/70" />
          </div>
          <div className="px-4 pb-2">
            <div className="text-lg font-semibold text-red-600/90">
              {formatCurrency(displayValues.totalExpense)}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
