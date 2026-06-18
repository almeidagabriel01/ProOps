"use client";

import { motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  formatDateStr,
  isWeekend,
  isPastDate,
  type DurationMinutes,
} from "@/lib/booking/slots";

const WEEKDAY_LABELS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MONTH_LABELS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

interface BookingCalendarProps {
  viewYear: number;
  viewMonth: number; // 1-12
  todayStr: string;
  selectedDate: string | null;
  fullyBookedDates: Set<string>;
  reduce: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (dateStr: string) => void;
  // mantido na assinatura para futura sinalização visual por duração
  duration: DurationMinutes;
}

export function BookingCalendar({
  viewYear,
  viewMonth,
  todayStr,
  selectedDate,
  fullyBookedDates,
  reduce,
  onPrevMonth,
  onNextMonth,
  onSelectDate,
}: BookingCalendarProps) {
  const firstDow = new Date(viewYear, viewMonth - 1, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // Não permite navegar para meses inteiramente no passado.
  const monthEndStr = formatDateStr(viewYear, viewMonth, daysInMonth);
  const prevDisabled = isPastDate(monthEndStr, todayStr);

  return (
    <div className="w-full">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold [font-family:var(--font-pdf-montserrat)]">
          {MONTH_LABELS[viewMonth - 1]}{" "}
          <span className="text-black/40 dark:text-white/40">{viewYear}</span>
        </h2>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onPrevMonth}
            disabled={prevDisabled}
            aria-label="Mês anterior"
            className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-black/5 disabled:opacity-30 dark:hover:bg-white/10"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onNextMonth}
            aria-label="Próximo mês"
            className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-black/5 dark:hover:bg-white/10"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((w) => (
          <div
            key={w}
            className="py-2 text-center text-[10px] font-semibold tracking-wider text-black/40 dark:text-white/40"
          >
            {w}
          </div>
        ))}
      </div>

      <motion.div
        key={`${viewYear}-${viewMonth}`}
        className="grid grid-cols-7 gap-1"
      >
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} />;
          const dateStr = formatDateStr(viewYear, viewMonth, day);
          const past = isPastDate(dateStr, todayStr);
          const weekend = isWeekend(viewYear, viewMonth, day);
          const fullyBooked = fullyBookedDates.has(dateStr);
          const disabled = past || weekend || fullyBooked;
          const selected = dateStr === selectedDate;
          const isToday = dateStr === todayStr;

          return (
            <motion.button
              key={dateStr}
              type="button"
              disabled={disabled}
              onClick={() => onSelectDate(dateStr)}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduce ? undefined : { duration: 0.35, delay: 0.01 * i, ease: [0.16, 1, 0.3, 1] }
              }
              whileHover={disabled || reduce ? undefined : { scale: 1.08 }}
              whileTap={disabled || reduce ? undefined : { scale: 0.95 }}
              className={[
                "relative flex aspect-square items-center justify-center rounded-xl text-sm font-medium transition-colors",
                disabled
                  ? "cursor-not-allowed text-black/20 line-through decoration-1 dark:text-white/20"
                  : "text-black/80 hover:bg-black/5 dark:text-white/80 dark:hover:bg-white/10",
              ].join(" ")}
            >
              {selected && (
                <motion.span
                  layoutId="selected-day"
                  className="absolute inset-0 rounded-xl bg-black dark:bg-white"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span
                className={
                  selected
                    ? "relative z-10 text-white dark:text-black"
                    : "relative z-10"
                }
              >
                {day}
              </span>
              {isToday && !selected && (
                <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-black/50 dark:bg-white/50" />
              )}
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
