"use client";

import * as React from "react";

interface ProposalFinancialSummarySmallProps {
  selectedProducts: any[];
  className?: string;
}

export function ProposalFinancialSummarySmall({
  selectedProducts,
  className,
}: ProposalFinancialSummarySmallProps) {
  // Calculate total selling value (with markup)
  const totalValue = selectedProducts.reduce((sum, p) => {
    return sum + p.total;
  }, 0);

  // Calculate total profit (markup only)
  const totalProfit = selectedProducts.reduce((sum, p) => {
    const basePrice = p.unitPrice * p.quantity;
    const profit = basePrice * ((p.markup || 0) / 100);
    return sum + profit;
  }, 0);

  return (
    <div className={`flex items-center gap-4 text-sm ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Total:</span>
        <span className="font-semibold">R$ {totalValue.toFixed(2)}</span>
      </div>
      <div className="w-px h-4 bg-border" />
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Lucro:</span>
        <span className="font-semibold text-green-600 dark:text-green-400">
          R$ {totalProfit.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
