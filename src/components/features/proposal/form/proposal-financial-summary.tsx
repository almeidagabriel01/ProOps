"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DollarSign } from "lucide-react";
import { ProposalProduct } from "@/types/proposal";

interface ProposalFinancialSummaryProps {
  selectedProducts: ProposalProduct[];
  extraExpense: number;
  onExtraExpenseChange: (value: number) => void;
  primaryColor: string;
}

export function ProposalFinancialSummary({
  selectedProducts,
  extraExpense,
  onExtraExpenseChange,
  primaryColor,
}: ProposalFinancialSummaryProps) {
  // Calculate total selling value (with markup)
  const totalValue = selectedProducts.reduce((sum, p) => {
    return sum + p.total;
  }, 0);

  // Calculate total profit (markup only)
  const totalProfit = selectedProducts.reduce((sum, p) => {
    if ((p.itemType || "product") === "service") {
      return sum + p.total;
    }
    const basePrice = p.unitPrice * p.quantity;
    const profit = basePrice * ((p.markup || 0) / 100);
    return sum + profit;
  }, 0);

  // Final total after extra expense
  const finalTotal = totalValue - extraExpense;

  const handleExtraExpenseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    onExtraExpenseChange(Math.max(0, value));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Resumo Financeiro
        </CardTitle>
        <CardDescription>Valores totais e lucro da proposta</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Value */}
          <div
            className="p-4 rounded-lg border-2"
            style={{
              backgroundColor: `${primaryColor}08`,
              borderColor: `${primaryColor}40`,
            }}
          >
            <p className="text-sm text-muted-foreground mb-1">Valor Total</p>
            <p className="text-2xl font-bold" style={{ color: primaryColor }}>
              R$ {totalValue.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Preços de venda com markup
            </p>
          </div>

          {/* Total Profit */}
          <div
            className="p-4 rounded-lg border-2"
            style={{
              backgroundColor: "#10b98108",
              borderColor: "#10b98140",
            }}
          >
            <p className="text-sm text-muted-foreground mb-1">Lucro Total</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              R$ {totalProfit.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Soma dos markups
            </p>
          </div>

          {/* Final Total */}
          <div
            className="p-4 rounded-lg border-2"
            style={{
              backgroundColor: `${primaryColor}15`,
              borderColor: `${primaryColor}60`,
            }}
          >
            <p className="text-sm text-muted-foreground mb-1">Total Final</p>
            <p className="text-2xl font-bold" style={{ color: primaryColor }}>
              R$ {finalTotal.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Após despesas extras
            </p>
          </div>
        </div>

        {/* Extra Expense Input */}
        <div className="pt-2 border-t">
          <label className="block text-sm font-medium mb-2">
            Valor Extra (Despesas)
          </label>
          <Input
            type="number"
            placeholder="0.00"
            value={extraExpense || ""}
            onChange={handleExtraExpenseChange}
            min="0"
            step="0.01"
            className="max-w-xs"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Este valor será subtraído do total final, mas não afeta o lucro
          </p>
        </div>

        {/* Breakdown Info */}
        {selectedProducts.length > 0 && (
          <div className="pt-2 border-t text-xs text-muted-foreground space-y-1">
            <p>
              <strong>{selectedProducts.length}</strong> produto(s) na proposta
            </p>
            <p>
              Margem de lucro média:{" "}
              <strong>
                {selectedProducts.length > 0
                  ? (
                      selectedProducts.reduce(
                        (sum, p) => sum + (p.markup || 0),
                        0,
                      ) / selectedProducts.length
                    ).toFixed(2)
                  : 0}
                %
              </strong>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
