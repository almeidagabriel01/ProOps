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
  sm: { px: 4, bounce: 7, gap: "gap-[4px]" },
  md: { px: 6, bounce: 10, gap: "gap-[6px]" },
  lg: { px: 8, bounce: 14, gap: "gap-[8px]" },
} satisfies Record<NonNullable<LoaderProps["size"]>, { px: number; bounce: number; gap: string }>;

function LoaderDots({
  size = "md",
  variant = "inline",
  label = "Carregando",
  className,
}: LoaderProps) {
  const { px, bounce, gap } = SIZES[size];
  const dotColor = variant === "button" ? "bg-current" : "bg-primary";

  return (
    <motion.span
      role="status"
      aria-label={label}
      className={cn("inline-flex items-end shrink-0", gap, className)}
      animate="animate"
      initial="initial"
      variants={{ animate: { transition: { staggerChildren: 0.15 } } }}
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className={cn("rounded-full shrink-0", dotColor)}
          style={{ width: px, height: px }}
          variants={{
            initial: { y: 0, opacity: 0.45, scale: 1 },
            animate: {
              y: [0, -bounce, 0],
              opacity: [0.45, 1, 0.45],
              scale: [1, 1.08, 1],
              transition: {
                duration: 0.6,
                repeat: Infinity,
                ease: "easeInOut",
              },
            },
          }}
        />
      ))}
    </motion.span>
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
        <LoaderDots size={size === "sm" ? "md" : size} label={label} />
      </div>
    );
  }

  if (variant === "page") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="bg-card border border-border/50 shadow-2xl rounded-2xl p-8 max-w-sm w-full text-center flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-200">
          <LoaderDots size="lg" label={label} />
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
        </div>
      </div>
    );
  }

  return (
    <LoaderDots size={size} variant={variant} label={label} className={className} />
  );
}
