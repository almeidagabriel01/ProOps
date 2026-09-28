"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { longDayLabel, monthGrid, monthLabel, shiftMonth } from "@/lib/booking/booking-format";

interface BookingCalendarProps {
  /** Dias com pelo menos um horário livre. */
  availableDates: ReadonlySet<string>;
  selected: string | null;
  /** "YYYY-MM" do mês à mostra. */
  month: string;
  minMonth: string;
  maxMonth: string;
  today: string;
  onMonthChange: (month: string) => void;
  onSelect: (date: string) => void;
}

const WEEKDAY_HEADERS = [
  { short: "D", long: "domingo" },
  { short: "S", long: "segunda" },
  { short: "T", long: "terça" },
  { short: "Q", long: "quarta" },
  { short: "Q", long: "quinta" },
  { short: "S", long: "sexta" },
  { short: "S", long: "sábado" },
];

/**
 * O mês em grade, como um calendário de parede. Só o dia com horário livre é
 * botão; os outros ficam apagados e fora da ordem do teclado.
 */
export function BookingCalendar({
  availableDates,
  selected,
  month,
  minMonth,
  maxMonth,
  today,
  onMonthChange,
  onSelect,
}: BookingCalendarProps) {
  const cells = monthGrid(month);
  const label = monthLabel(month);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-base font-semibold first-letter:uppercase" aria-live="polite">
          {label}
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Mês anterior"
            disabled={month <= minMonth}
            onClick={() => onMonthChange(shiftMonth(month, -1))}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Próximo mês"
            disabled={month >= maxMonth}
            onClick={() => onMonthChange(shiftMonth(month, 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center" aria-hidden="true">
        {WEEKDAY_HEADERS.map((weekday) => (
          <abbr
            key={weekday.long}
            title={weekday.long}
            className="py-1 text-xs font-medium uppercase text-muted-foreground no-underline"
          >
            {weekday.short}
          </abbr>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1" role="group" aria-label={`Dias de ${label}`}>
        {cells.map((date, index) => {
          if (!date) return <span key={`vazio-${index}`} aria-hidden="true" />;
          const day = Number(date.slice(8));
          const isToday = date === today;
          if (!availableDates.has(date)) {
            return (
              <span
                key={date}
                aria-hidden="true"
                className="relative flex aspect-square items-center justify-center rounded-full text-sm text-muted-foreground/40"
              >
                {day}
                {isToday && <TodayDot />}
              </span>
            );
          }
          const active = date === selected;
          return (
            <button
              key={date}
              type="button"
              aria-pressed={active}
              aria-label={longDayLabel(date)}
              onClick={() => onSelect(date)}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-full text-sm font-semibold tabular-nums transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-line)] focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                active
                  ? "bg-[var(--brand)] text-[var(--brand-fg)] shadow-md ring-1 ring-[var(--brand-line)]"
                  : "bg-[color-mix(in_oklab,var(--brand-line)_18%,transparent)] text-foreground ring-1 ring-inset ring-[color-mix(in_oklab,var(--brand-line)_35%,transparent)] hover:bg-[color-mix(in_oklab,var(--brand-line)_30%,transparent)]",
              )}
            >
              {day}
              {isToday && <TodayDot />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TodayDot() {
  return <span aria-hidden="true" className="absolute bottom-1 h-1 w-1 rounded-full bg-current opacity-70" />;
}
