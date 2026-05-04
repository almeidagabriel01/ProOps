"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

interface SegmentOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface FilterSegmentedProps {
  id: string;
  options: SegmentOption[];
  value: string;
  onChange: (v: string) => void;
}

export function FilterSegmented({ id, options, value, onChange }: FilterSegmentedProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      role="group"
      aria-label={id}
      className="bg-muted/60 p-1 rounded-xl inline-flex items-center gap-0.5"
    >
      {options.map((opt) => {
        const isActive = opt.value === value;

        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={isActive}
            className={cn(
              "relative h-8 px-3 rounded-lg text-xs font-medium",
              "transition-colors duration-150 cursor-pointer whitespace-nowrap",
              isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              isActive && shouldReduceMotion && "bg-card shadow-sm",
            )}
          >
            {/* Background rendered first so text stacks on top via DOM order */}
            <AnimatePresence>
              {isActive && !shouldReduceMotion && (
                <motion.div
                  key="active-bg"
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.88 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="absolute inset-0 rounded-[0.45rem] bg-card shadow-sm"
                />
              )}
            </AnimatePresence>
            <span className="relative flex items-center gap-1.5">
              {opt.icon}
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
