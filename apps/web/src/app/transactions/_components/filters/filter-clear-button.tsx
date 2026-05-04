"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FilterClearButtonProps {
  active: boolean;
  count: number;
  onClear: () => void;
}

export function FilterClearButton({ active, count, onClear }: FilterClearButtonProps) {
  const shouldReduceMotion = useReducedMotion();

  const buttonClass =
    "inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border/60 text-xs text-muted-foreground hover:text-foreground hover:border-border/80 hover:bg-muted/40 transition-colors shrink-0 cursor-pointer select-none";

  if (shouldReduceMotion) {
    if (!active) return null;
    return (
      <button type="button" onClick={onClear} className={buttonClass}>
        <X className="w-3.5 h-3.5" />
        Limpar
        {count > 0 && (
          <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px] leading-none">
            {count}
          </Badge>
        )}
      </button>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {active && (
        <motion.button
          key="clear-btn"
          type="button"
          onClick={onClear}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className={buttonClass}
        >
          <X className="w-3.5 h-3.5" />
          Limpar
          {count > 0 && (
            <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px] leading-none">
              {count}
            </Badge>
          )}
        </motion.button>
      )}
    </AnimatePresence>
  );
}
