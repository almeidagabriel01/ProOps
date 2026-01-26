"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Clock, AlertCircle } from "lucide-react";
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
}

export function FinancialSummaryCards({
  summary,
  selectionSummary,
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className={hasSelection ? "ring-2 ring-primary/20" : ""}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">
              Receitas Pagas
            </CardTitle>
            {hasSelection && (
              <Badge variant="secondary" className="text-[10px] h-5">
                {selectionSummary.count} sel.
              </Badge>
            )}
          </div>
          <TrendingUp className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-500">
            {formatCurrency(displayValues.totalIncome)}
          </div>
        </CardContent>
      </Card>

      <Card className={hasSelection ? "ring-2 ring-primary/20" : ""}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">
              Despesas Pagas
            </CardTitle>
            {hasSelection && (
              <Badge variant="secondary" className="text-[10px] h-5">
                {selectionSummary.count} sel.
              </Badge>
            )}
          </div>
          <TrendingDown className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-500">
            {formatCurrency(displayValues.totalExpense)}
          </div>
        </CardContent>
      </Card>

      <Card className={hasSelection ? "ring-2 ring-primary/20" : ""}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">A Receber</CardTitle>
            {hasSelection && (
              <Badge variant="secondary" className="text-[10px] h-5">
                {selectionSummary.count} sel.
              </Badge>
            )}
          </div>
          <Clock className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-500">
            {formatCurrency(displayValues.pendingIncome)}
          </div>
        </CardContent>
      </Card>

      <Card className={hasSelection ? "ring-2 ring-primary/20" : ""}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">A Pagar</CardTitle>
            {hasSelection && (
              <Badge variant="secondary" className="text-[10px] h-5">
                {selectionSummary.count} sel.
              </Badge>
            )}
          </div>
          <AlertCircle className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-500">
            {formatCurrency(displayValues.pendingExpense)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
