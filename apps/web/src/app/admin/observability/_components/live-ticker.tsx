// apps/web/src/app/admin/observability/_components/live-ticker.tsx
"use client";

import { AnimatePresence, m } from "motion/react";
import { cn } from "@/lib/utils";
import { severityAccent } from "@/lib/observability/issue-format";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import type { ErrorIssue } from "@/types/observability";

export function LiveTicker({ latest }: { latest: ErrorIssue | null }) {
  const reduced = usePrefersReducedMotion();
  return (
    <div className="flex h-6 items-center gap-2 overflow-hidden text-xs text-black/50 dark:text-white/50">
      <span className="shrink-0 font-semibold uppercase tracking-[0.18em]">Ao vivo</span>
      <AnimatePresence mode="wait">
        {latest && (
          <m.span
            key={latest.fingerprint + latest.lastSeen}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="flex min-w-0 items-center gap-1.5"
          >
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", severityAccent(latest.severity).dot)} />
            <span className="truncate">{latest.title}</span>
          </m.span>
        )}
      </AnimatePresence>
    </div>
  );
}
