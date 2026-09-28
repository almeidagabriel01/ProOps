"use client";

import * as React from "react";
import { Moon, Sun, Sunrise } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMinutes, groupStartsByPeriod, longDayLabel, type DayPeriod } from "@/lib/booking/booking-format";

interface BookingTimeSlotsProps {
  date: string;
  starts: number[];
  selected: number | null;
  onSelect: (startMin: number) => void;
}

const PERIOD_ICONS: Record<DayPeriod, React.ComponentType<{ className?: string }>> = {
  manha: Sunrise,
  tarde: Sun,
  noite: Moon,
};

/** Os horários livres do dia escolhido, separados em manhã, tarde e noite. */
export function BookingTimeSlots({ date, starts, selected, onSelect }: BookingTimeSlotsProps) {
  const groups = groupStartsByPeriod(starts);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-base font-semibold first-letter:uppercase">{longDayLabel(date)}</p>
        <p className="text-sm text-muted-foreground">
          {starts.length === 1 ? "1 horário livre" : `${starts.length} horários livres`}
        </p>
      </div>

      <div className="space-y-4">
        {groups.map((group) => {
          const Icon = PERIOD_ICONS[group.id];
          return (
            <section key={group.id} className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                {group.label}
              </h3>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-2" role="group" aria-label={group.label}>
                {group.starts.map((start) => {
                  const active = start === selected;
                  return (
                    <button
                      key={start}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onSelect(start)}
                      className={cn(
                        "rounded-lg border py-2.5 text-sm font-medium tabular-nums transition",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-line)] focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                        active
                          ? "border-[var(--brand-line)] bg-[var(--brand)] text-[var(--brand-fg)] shadow-sm"
                          : "border-border bg-card hover:border-[var(--brand-line)] hover:bg-[color-mix(in_oklab,var(--brand-line)_8%,transparent)]",
                      )}
                    >
                      {formatMinutes(start)}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
