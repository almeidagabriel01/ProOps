// apps/web/src/app/admin/observability/_components/status-pill.tsx
"use client";

import { cn } from "@/lib/utils";
import type { ErrorIssueStatus } from "@/types/observability";
import { statusLabel } from "@/lib/observability/issue-format";

export function StatusPill({ status, className }: { status: ErrorIssueStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        status === "unresolved" && "border-black/15 text-black/70 dark:border-white/20 dark:text-white/70",
        status === "resolved" && "border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
        status === "ignored" && "border-black/10 text-black/40 line-through dark:border-white/10 dark:text-white/40",
        className,
      )}
    >
      {statusLabel(status)}
    </span>
  );
}
