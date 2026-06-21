// apps/web/src/app/admin/observability/_components/glass-card.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { ErrorSeverity } from "@/types/observability";
import { severityAccent } from "@/lib/observability/issue-format";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  accent?: ErrorSeverity;
}

export function GlassCard({ accent, className, children, ...rest }: GlassCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-black/10 bg-white/70 shadow-sm",
        "backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.03]",
        "ring-1 ring-inset ring-white/40 dark:ring-white/5",
        className,
      )}
      {...rest}
    >
      {accent && (
        <span
          aria-hidden
          className={cn("absolute inset-x-0 top-0 h-px", severityAccent(accent).dot)}
        />
      )}
      {children}
    </div>
  );
}
