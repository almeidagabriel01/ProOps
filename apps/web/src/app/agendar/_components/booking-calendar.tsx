"use client";

import { AnimatePresence, m as motion } from "motion/react";
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

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

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

  const navBtn =
    "flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-black/10 text-black/70 transition hover:border-black hover:bg-black hover:text-white disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-25 dark:border-white/15 dark:text-white/70 dark:hover:border-white dark:hover:bg-white dark:hover:text-black";

  return (
    <div className="w-full">
      <div className="mb-7 flex items-center justify-between">
        <div className="overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.h2
              key={`${viewYear}-${viewMonth}`}
              initial={reduce ? false : { y: "100%", opacity: 0 }}
              animate={{ y: "0%", opacity: 1 }}
              exit={reduce ? undefined : { y: "-100%", opacity: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="text-xl font-bold tracking-tight [font-family:var(--font-pdf-montserrat)]"
            >
              {MONTH_LABELS[viewMonth - 1]}{" "}
              <span className="text-black/35 dark:text-white/35">{viewYear}</span>
            </motion.h2>
          </AnimatePresence>
        </div>
        <div className="flex gap-2">
          <motion.button
            type="button"
            onClick={onPrevMonth}
            disabled={prevDisabled}
            aria-label="Mês anterior"
            whileTap={{ scale: 0.9 }}
            className={navBtn}
          >
            <ChevronLeft className="h-4 w-4" />
          </motion.button>
          <motion.button
            type="button"
            onClick={onNextMonth}
            aria-label="Próximo mês"
            whileTap={{ scale: 0.9 }}
            className={navBtn}
          >
            <ChevronRight className="h-4 w-4" />
          </motion.button>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-7 gap-1.5">
        {WEEKDAY_LABELS.map((w) => (
          <div
            key={w}
            className="py-1.5 text-center text-[10px] font-bold tracking-[0.12em] text-black/35 dark:text-white/35"
          >
            {w}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${viewYear}-${viewMonth}`}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduce ? undefined : { opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="grid grid-cols-7 gap-1.5"
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

            // onda de revelação: combina linha + coluna p/ varredura diagonal
            const row = Math.floor(i / 7);
            const col = i % 7;
            const waveDelay = reduce ? 0 : (row + col) * 0.025;

            return (
              <motion.button
                key={dateStr}
                type="button"
                disabled={disabled}
                onClick={() => onSelectDate(dateStr)}
                initial={reduce ? false : { opacity: 0, y: 10, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, delay: waveDelay, ease: EASE }}
                whileHover={
                  disabled || reduce
                    ? undefined
                    : { scale: 1.12, transition: { type: "spring", stiffness: 400, damping: 18 } }
                }
                whileTap={disabled || reduce ? undefined : { scale: 0.92 }}
                className={[
                  "relative flex aspect-square items-center justify-center rounded-2xl text-sm font-semibold transition-colors",
                  disabled
                    ? "cursor-not-allowed text-black/20 line-through decoration-1 dark:text-white/20"
                    : "cursor-pointer text-black/80 hover:bg-black/[0.04] dark:text-white/80 dark:hover:bg-white/[0.07]",
                ].join(" ")}
              >
                {selected && (
                  <motion.span
                    layoutId="selected-day"
                    className="absolute inset-0 rounded-2xl bg-black shadow-[0_8px_24px_-8px_rgba(0,0,0,0.55)] dark:bg-white"
                    transition={{ type: "spring", stiffness: 460, damping: 34 }}
                  />
                )}
                {/* anel do "hoje" — pulsa suavemente */}
                {isToday && !selected && !reduce && (
                  <motion.span
                    aria-hidden
                    className="absolute inset-[3px] rounded-2xl border border-black/30 dark:border-white/40"
                    animate={{ opacity: [0.25, 0.75, 0.25] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
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
              </motion.button>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
