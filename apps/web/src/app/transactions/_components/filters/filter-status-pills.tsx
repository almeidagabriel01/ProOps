"use client";

import * as React from "react";
import { motion } from "motion/react";
import { CheckCircle, Clock, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TransactionStatus } from "@/services/transaction-service";

interface StatusConfig {
  label: string;
  Icon: React.ElementType;
  activeClass: string;
  inactiveClass: string;
  dotColor: string;
}

const STATUS_CONFIG: Record<TransactionStatus, StatusConfig> = {
  paid: {
    label: "Pago",
    Icon: CheckCircle,
    activeClass:
      "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20",
    inactiveClass:
      "border-border/50 text-muted-foreground hover:border-emerald-400/50 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-500/5",
    dotColor: "bg-emerald-500",
  },
  pending: {
    label: "Pendente",
    Icon: Clock,
    activeClass:
      "bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/20",
    inactiveClass:
      "border-border/50 text-muted-foreground hover:border-amber-400/50 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-500/5",
    dotColor: "bg-amber-500",
  },
  overdue: {
    label: "Atrasado",
    Icon: AlertCircle,
    activeClass:
      "bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/20",
    inactiveClass:
      "border-border/50 text-muted-foreground hover:border-rose-400/50 hover:text-rose-700 dark:hover:text-rose-400 hover:bg-rose-500/5",
    dotColor: "bg-rose-500",
  },
};

const ALL_STATUSES: TransactionStatus[] = ["paid", "pending", "overdue"];

interface FilterStatusPillsProps {
  value: TransactionStatus[];
  onChange: (v: TransactionStatus[]) => void;
}

export function FilterStatusPills({ value, onChange }: FilterStatusPillsProps) {
  const toggle = (s: TransactionStatus) => {
    const next = value.includes(s)
      ? value.filter((x) => x !== s)
      : [...value, s];
    onChange(next);
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {ALL_STATUSES.map((s) => {
        const { label, Icon, activeClass, inactiveClass, dotColor } =
          STATUS_CONFIG[s];
        const isActive = value.includes(s);

        return (
          <motion.button
            key={s}
            type="button"
            onClick={() => toggle(s)}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.1 }}
            className={cn(
              "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border text-sm font-medium",
              "transition-all duration-200 cursor-pointer select-none shrink-0",
              isActive ? activeClass : inactiveClass,
            )}
          >
            {isActive ? (
              <Icon className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <span className={cn("w-2 h-2 rounded-full shrink-0", dotColor)} />
            )}
            {label}
          </motion.button>
        );
      })}

      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          title="Limpar filtros de status"
          aria-label="Limpar filtros de status"
          className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
