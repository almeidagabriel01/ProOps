"use client";

import * as React from "react";
import { DatePicker } from "@/components/ui/date-picker";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface FilterPeriodProps {
  dateType: "date" | "dueDate";
  onDateTypeChange: (v: "date" | "dueDate") => void;
  startDate: string;
  onStartDateChange: (v: string) => void;
  endDate: string;
  onEndDateChange: (v: string) => void;
}

const compactDate = "h-9 rounded-lg border border-border/60 shadow-none px-3 py-0";

export function FilterPeriod({
  dateType,
  onDateTypeChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
}: FilterPeriodProps) {
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:flex-wrap">
      <Select
        inputSize="sm"
        value={dateType}
        onChange={(e) => onDateTypeChange(e.target.value as "date" | "dueDate")}
        className="w-full sm:w-40 sm:shrink-0"
        disableSort
      >
        <option value="dueDate">Por vencimento</option>
        <option value="date">Por lançamento</option>
      </Select>

      {/* sm:contents devolve os três filhos ao flex do pai a partir de sm, então
          o desktop continua sendo a mesma linha de antes. */}
      <div className="grid grid-cols-2 gap-2 sm:contents">
        <DatePicker
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          placeholder="Data inicial"
          className={cn(compactDate, "w-full sm:w-36 sm:shrink-0")}
        />

        <span className="hidden text-xs text-muted-foreground/60 shrink-0 select-none sm:inline">
          —
        </span>

        <DatePicker
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          placeholder="Data final"
          className={cn(compactDate, "w-full sm:w-36 sm:shrink-0")}
        />
      </div>
    </div>
  );
}
