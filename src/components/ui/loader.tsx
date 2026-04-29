"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * <Loader /> — single loading primitive. Use instead of Loader2 + animate-spin everywhere.
 *
 * PROHIBITED:
 * - Loader inside a virtualised list cell (use skeleton on the parent)
 * - Loader inside map() with >20 items (use 1 Loader contained on the parent)
 * - Loader in a button without using <Button loading> (don't duplicate the pattern)
 */

interface LoaderProps {
  size?: "sm" | "md" | "lg";
  variant?: "inline" | "button" | "page" | "contained";
  className?: string;
  label?: string;
}

const SIZES = {
  sm: { dot: 4, w: 24 },
  md: { dot: 6, w: 34 },
  lg: { dot: 8, w: 50 },
} satisfies Record<NonNullable<LoaderProps["size"]>, { dot: number; w: number }>;

// Keyframe times: converge → hold → diverge → hold
const TIMES = [0, 0.38, 0.5, 0.88, 1];
const DURATION = 1.5;

function LoaderMark({
  size = "md",
  variant = "inline",
  label = "Carregando",
  className,
}: LoaderProps) {
  const { dot, w } = SIZES[size];
  const converge = (w - dot) / 2;
  const color = variant === "button" ? "bg-current" : "bg-primary";

  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        "relative inline-flex items-center justify-between shrink-0",
        className,
      )}
      style={{ width: w, height: dot }}
    >
      {/* Left dot — moves right toward center */}
      <motion.span
        className={cn("rounded-full shrink-0", color)}
        style={{ width: dot, height: dot }}
        animate={{
          x: [0, converge, converge, 0, 0],
          opacity: [1, 0.15, 0.15, 1, 1],
        }}
        transition={{
          duration: DURATION,
          times: TIMES,
          ease: ["easeIn", "linear", "easeOut", "linear"],
          repeat: Infinity,
        }}
      />

      {/* Center dot — pulses when outer dots arrive */}
      <motion.span
        className={cn("absolute rounded-full shrink-0", color)}
        style={{ width: dot, height: dot, left: (w - dot) / 2 }}
        animate={{
          scale: [1, 1, 1.5, 1, 1],
          opacity: [0.45, 0.45, 1, 0.45, 0.45],
        }}
        transition={{
          duration: DURATION,
          times: TIMES,
          ease: ["linear", "easeOut", "easeIn", "linear"],
          repeat: Infinity,
        }}
      />

      {/* Right dot — moves left toward center */}
      <motion.span
        className={cn("rounded-full shrink-0", color)}
        style={{ width: dot, height: dot }}
        animate={{
          x: [0, -converge, -converge, 0, 0],
          opacity: [1, 0.15, 0.15, 1, 1],
        }}
        transition={{
          duration: DURATION,
          times: TIMES,
          ease: ["easeIn", "linear", "easeOut", "linear"],
          repeat: Infinity,
        }}
      />
    </span>
  );
}

export function Loader({
  size = "md",
  variant = "inline",
  className,
  label = "Carregando",
}: LoaderProps) {
  if (variant === "contained") {
    return (
      <div className="flex items-center justify-center min-h-[200px] w-full">
        <LoaderMark size={size === "sm" ? "md" : size} label={label} />
      </div>
    );
  }

  if (variant === "page") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="bg-card border border-border/50 shadow-2xl rounded-2xl p-8 max-w-sm w-full text-center flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-200">
          <LoaderMark size="lg" label={label} />
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
        </div>
      </div>
    );
  }

  return (
    <LoaderMark size={size} variant={variant} label={label} className={className} />
  );
}
