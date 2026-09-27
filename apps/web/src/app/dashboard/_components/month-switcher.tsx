"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMonthLabel, shiftMonth } from "@/lib/month-key";

interface MonthSwitcherProps {
  month: string;
  isCurrentMonth: boolean;
  onChange: (month: string) => void;
}

/**
 * Escolhe o mês do resumo mensal (despesas, carteiras e comissões). Só volta
 * no tempo: o mês corrente é o último, porque o resumo conta o que foi pago.
 */
export function MonthSwitcher({ month, isCurrentMonth, onChange }: MonthSwitcherProps) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Mês do resumo">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => onChange(shiftMonth(month, -1))}
        aria-label="Mês anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-36 text-center text-sm font-medium" aria-live="polite">
        {formatMonthLabel(month)}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => onChange(shiftMonth(month, 1))}
        disabled={isCurrentMonth}
        aria-label="Próximo mês"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
