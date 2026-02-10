"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

// ============================================
// TYPES
// ============================================

export interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  name?: string;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  min?: string;
  max?: string;
}

type CalendarView = "days" | "months" | "years";

// ============================================
// CONSTANTS
// ============================================

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const MONTH_NAMES_SHORT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// ============================================
// HELPERS
// ============================================

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return "";
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isToday(year: number, month: number, day: number): boolean {
  const today = new Date();
  return (
    today.getFullYear() === year &&
    today.getMonth() === month &&
    today.getDate() === day
  );
}

// ============================================
// COMPONENT
// ============================================

const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  (
    {
      value,
      onChange,
      onBlur,
      name,
      id,
      placeholder = "Selecionar data",
      disabled = false,
      required = false,
      className,
      min,
      max,
    },
    ref,
  ) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [view, setView] = React.useState<CalendarView>("days");
    const [openAbove, setOpenAbove] = React.useState(false);

    // The currently displayed month/year in the calendar
    const [displayMonth, setDisplayMonth] = React.useState(() => {
      if (value) {
        const [y, m] = value.split("-").map(Number);
        if (y && m) return { year: y, month: m - 1 };
      }
      const now = new Date();
      return { year: now.getFullYear(), month: now.getMonth() };
    });

    // For year grid: start year of the current 12-year window
    const [yearRangeStart, setYearRangeStart] = React.useState(
      () => Math.floor(displayMonth.year / 12) * 12,
    );

    const containerRef = React.useRef<HTMLDivElement>(null);
    const hiddenInputRef = React.useRef<HTMLInputElement>(null);
    const popoverRef = React.useRef<HTMLDivElement>(null);

    // Merge refs for the hidden input
    React.useImperativeHandle(ref, () => hiddenInputRef.current!);

    // Sync display month when value changes externally
    React.useEffect(() => {
      if (value) {
        const [y, m] = value.split("-").map(Number);
        if (y && m) {
          setDisplayMonth({ year: y, month: m - 1 });
          setYearRangeStart(Math.floor(y / 12) * 12);
        }
      }
    }, [value]);

    // Close on click outside
    React.useEffect(() => {
      if (!isOpen) return;
      const handleClickOutside = (e: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(e.target as Node)
        ) {
          setIsOpen(false);
          setView("days");
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    // Close on Escape
    React.useEffect(() => {
      if (!isOpen) return;
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setIsOpen(false);
          setView("days");
        }
      };
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen]);

    // Emit a synthetic onChange event
    const emitChange = React.useCallback(
      (dateStr: string) => {
        const syntheticEvent = {
          target: {
            name: name || "",
            value: dateStr,
            type: "text",
          },
          currentTarget: {
            name: name || "",
            value: dateStr,
            type: "text",
          },
          preventDefault: () => {},
          stopPropagation: () => {},
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      },
      [name, onChange],
    );

    // Parse selected date
    const selectedDate = React.useMemo(() => {
      if (!value) return null;
      const [y, m, d] = value.split("-").map(Number);
      if (!y || !m || !d) return null;
      return { year: y, month: m - 1, day: d };
    }, [value]);

    // ---- DAY SELECTION ----
    const handleDayClick = (day: number) => {
      const dateStr = `${displayMonth.year}-${pad(displayMonth.month + 1)}-${pad(day)}`;
      emitChange(dateStr);
      setIsOpen(false);
      setView("days");
    };

    // ---- MONTH SELECTION ----
    const handleMonthClick = (monthIdx: number) => {
      setDisplayMonth((prev) => ({ ...prev, month: monthIdx }));
      setView("days");
    };

    // ---- YEAR SELECTION ----
    const handleYearClick = (year: number) => {
      setDisplayMonth((prev) => ({ ...prev, year }));
      setYearRangeStart(Math.floor(year / 12) * 12);
      setView("months");
    };

    // ---- NAVIGATION ----
    const goToPrevMonth = () => {
      setDisplayMonth((prev) => {
        if (prev.month === 0) return { year: prev.year - 1, month: 11 };
        return { ...prev, month: prev.month - 1 };
      });
    };

    const goToNextMonth = () => {
      setDisplayMonth((prev) => {
        if (prev.month === 11) return { year: prev.year + 1, month: 0 };
        return { ...prev, month: prev.month + 1 };
      });
    };

    const goToPrevYearRange = () => {
      setYearRangeStart((prev) => prev - 12);
    };

    const goToNextYearRange = () => {
      setYearRangeStart((prev) => prev + 12);
    };

    // ---- GENERATE CALENDAR GRID ----
    const calendarDays = React.useMemo(() => {
      const daysInMonth = getDaysInMonth(displayMonth.year, displayMonth.month);
      const firstDay = getFirstDayOfMonth(
        displayMonth.year,
        displayMonth.month,
      );

      // Previous month trailing days
      const prevMonth = displayMonth.month === 0 ? 11 : displayMonth.month - 1;
      const prevYear =
        displayMonth.month === 0 ? displayMonth.year - 1 : displayMonth.year;
      const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);

      const days: Array<{
        day: number;
        isCurrentMonth: boolean;
        isToday: boolean;
        isSelected: boolean;
      }> = [];

      // Fill previous month days
      for (let i = firstDay - 1; i >= 0; i--) {
        const d = daysInPrevMonth - i;
        days.push({
          day: d,
          isCurrentMonth: false,
          isToday: false,
          isSelected: false,
        });
      }

      // Fill current month days
      for (let d = 1; d <= daysInMonth; d++) {
        days.push({
          day: d,
          isCurrentMonth: true,
          isToday: isToday(displayMonth.year, displayMonth.month, d),
          isSelected:
            selectedDate !== null &&
            selectedDate.year === displayMonth.year &&
            selectedDate.month === displayMonth.month &&
            selectedDate.day === d,
        });
      }

      // Fill next month days to complete the grid (6 rows × 7 = 42)
      const remaining = 42 - days.length;
      for (let d = 1; d <= remaining; d++) {
        days.push({
          day: d,
          isCurrentMonth: false,
          isToday: false,
          isSelected: false,
        });
      }

      return days;
    }, [displayMonth, selectedDate]);

    // ---- YEAR RANGE FOR GRID ----
    const yearRange = React.useMemo(() => {
      const years: number[] = [];
      for (let i = 0; i < 12; i++) {
        years.push(yearRangeStart + i);
      }
      return years;
    }, [yearRangeStart]);

    const handleToggle = () => {
      if (disabled) return;
      if (!isOpen) {
        // Calculate whether to open above or below
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const spaceBelow = window.innerHeight - rect.bottom;
          setOpenAbove(spaceBelow < 380);
        }
        setView("days");
      }
      setIsOpen((prev) => !prev);
    };

    const goToToday = () => {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      emitChange(dateStr);
      setDisplayMonth({ year: now.getFullYear(), month: now.getMonth() });
      setIsOpen(false);
      setView("days");
    };

    return (
      <div ref={containerRef} className="relative group">
        {/* Hidden input for form compatibility */}
        <input
          ref={hiddenInputRef}
          type="hidden"
          name={name}
          value={value || ""}
          id={id}
          required={required}
          min={min}
          max={max}
        />

        {/* Display Input */}
        <button
          type="button"
          disabled={disabled}
          onClick={handleToggle}
          onBlur={(e) => {
            // Only fire onBlur if focus leaves the entire container
            if (
              containerRef.current &&
              !containerRef.current.contains(e.relatedTarget as Node)
            ) {
              onBlur?.(e as unknown as React.FocusEvent<HTMLInputElement>);
            }
          }}
          className={cn(
            "flex items-center h-12 w-full rounded-xl border-2 border-border/60 bg-card px-4 py-3 text-sm text-left cursor-pointer",
            "shadow-sm transition-[border-color,box-shadow] duration-200 ease-out",
            "hover:border-primary/40 hover:shadow-md",
            "focus:outline-none focus:border-primary focus:shadow-lg focus:shadow-primary/10",
            "focus:ring-4 focus:ring-primary/10",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border/60 disabled:hover:shadow-sm",
            !value && "text-muted-foreground/60",
            isOpen &&
              "border-primary shadow-lg shadow-primary/10 ring-4 ring-primary/10",
            className,
          )}
        >
          <span className="flex-1 truncate">
            {value ? formatDisplayDate(value) : placeholder}
          </span>
          <Calendar
            className={cn(
              "w-4 h-4 ml-2 shrink-0 transition-colors",
              isOpen
                ? "text-primary"
                : "text-muted-foreground group-hover:text-primary",
            )}
          />
        </button>

        {/* Popover */}
        {isOpen && (
          <div
            ref={popoverRef}
            className={cn(
              "absolute z-50 w-[310px] rounded-2xl border-2 border-border/60 bg-card shadow-2xl",
              "animate-in fade-in-0 zoom-in-95 duration-150",
              "overflow-hidden",
              openAbove ? "bottom-full mb-2" : "top-full mt-2",
            )}
            style={{ left: 0 }}
          >
            {/* ==================== DAYS VIEW ==================== */}
            {view === "days" && (
              <div>
                {/* Header */}
                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                  <button
                    type="button"
                    onClick={goToPrevMonth}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setView("months")}
                      className="px-2 py-1 rounded-lg text-sm font-semibold hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                    >
                      {MONTH_NAMES[displayMonth.month]}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setYearRangeStart(
                          Math.floor(displayMonth.year / 12) * 12,
                        );
                        setView("years");
                      }}
                      className="px-2 py-1 rounded-lg text-sm font-semibold hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                    >
                      {displayMonth.year}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={goToNextMonth}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Weekday headers */}
                <div className="grid grid-cols-7 px-3 pb-1">
                  {WEEKDAYS.map((wd) => (
                    <div
                      key={wd}
                      className="text-center text-xs font-medium text-muted-foreground py-1"
                    >
                      {wd}
                    </div>
                  ))}
                </div>

                {/* Day Grid */}
                <div className="grid grid-cols-7 px-3 pb-3 gap-0.5">
                  {calendarDays.map((d, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={!d.isCurrentMonth}
                      onClick={() => d.isCurrentMonth && handleDayClick(d.day)}
                      className={cn(
                        "relative w-full aspect-square rounded-lg text-sm flex items-center justify-center transition-all duration-150",
                        d.isCurrentMonth
                          ? "hover:bg-primary/10 hover:text-primary cursor-pointer"
                          : "text-muted-foreground/30 cursor-default",
                        d.isSelected &&
                          "bg-primary text-primary-foreground font-bold hover:bg-primary/90 hover:text-primary-foreground shadow-md",
                        d.isToday &&
                          !d.isSelected &&
                          "font-bold text-primary ring-2 ring-primary/30",
                        !d.isSelected && d.isCurrentMonth && "font-medium",
                      )}
                    >
                      {d.day}
                    </button>
                  ))}
                </div>

                {/* Footer */}
                <div className="px-4 py-2.5 border-t border-border/40 flex items-center justify-between bg-muted/30">
                  <button
                    type="button"
                    onClick={goToToday}
                    className="text-xs font-medium text-primary hover:text-primary/80 transition-colors px-2 py-1 rounded-md hover:bg-primary/10 cursor-pointer"
                  >
                    Hoje
                  </button>
                  {value && (
                    <button
                      type="button"
                      onClick={() => {
                        emitChange("");
                        setIsOpen(false);
                      }}
                      className="text-xs font-medium text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-md hover:bg-destructive/10 cursor-pointer"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ==================== MONTHS VIEW ==================== */}
            {view === "months" && (
              <div>
                <div className="flex items-center justify-between px-4 pt-4 pb-3">
                  <button
                    type="button"
                    onClick={() =>
                      setDisplayMonth((prev) => ({
                        ...prev,
                        year: prev.year - 1,
                      }))
                    }
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setYearRangeStart(
                        Math.floor(displayMonth.year / 12) * 12,
                      );
                      setView("years");
                    }}
                    className="text-sm font-bold hover:text-primary transition-colors px-3 py-1 rounded-lg hover:bg-primary/10 cursor-pointer"
                  >
                    {displayMonth.year}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDisplayMonth((prev) => ({
                        ...prev,
                        year: prev.year + 1,
                      }))
                    }
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 px-4 pb-4">
                  {MONTH_NAMES_SHORT.map((m, idx) => {
                    const isCurrent = displayMonth.month === idx;
                    const isCurrentMonth =
                      new Date().getFullYear() === displayMonth.year &&
                      new Date().getMonth() === idx;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleMonthClick(idx)}
                        className={cn(
                          "py-3 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer",
                          isCurrent
                            ? "bg-primary text-primary-foreground font-bold shadow-md"
                            : "hover:bg-primary/10 hover:text-primary",
                          isCurrentMonth &&
                            !isCurrent &&
                            "ring-2 ring-primary/30 font-bold text-primary",
                        )}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ==================== YEARS VIEW ==================== */}
            {view === "years" && (
              <div>
                <div className="flex items-center justify-between px-4 pt-4 pb-3">
                  <button
                    type="button"
                    onClick={goToPrevYearRange}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-bold text-muted-foreground">
                    {yearRangeStart} — {yearRangeStart + 11}
                  </span>
                  <button
                    type="button"
                    onClick={goToNextYearRange}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 px-4 pb-4">
                  {yearRange.map((year) => {
                    const isCurrent = displayMonth.year === year;
                    const isCurrentYear = new Date().getFullYear() === year;
                    return (
                      <button
                        key={year}
                        type="button"
                        onClick={() => handleYearClick(year)}
                        className={cn(
                          "py-3 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer",
                          isCurrent
                            ? "bg-primary text-primary-foreground font-bold shadow-md"
                            : "hover:bg-primary/10 hover:text-primary",
                          isCurrentYear &&
                            !isCurrent &&
                            "ring-2 ring-primary/30 font-bold text-primary",
                        )}
                      >
                        {year}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);
DatePicker.displayName = "DatePicker";

export { DatePicker };
