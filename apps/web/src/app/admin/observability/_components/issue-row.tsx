// apps/web/src/app/admin/observability/_components/issue-row.tsx
"use client";

import { m } from "motion/react";
import { cn } from "@/lib/utils";
import { SeverityBadge } from "./severity-badge";
import { StatusPill } from "./status-pill";
import { relativeTime, severityAccent } from "@/lib/observability/issue-format";
import type { ErrorIssue } from "@/types/observability";

export function IssueRow({ issue, onSelect }: { issue: ErrorIssue; onSelect: (i: ErrorIssue) => void }) {
  return (
    <m.button
      type="button"
      onClick={() => onSelect(issue)}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 24 }}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left",
        "hover:border-black/10 hover:bg-black/[0.02] dark:hover:border-white/10 dark:hover:bg-white/[0.03]",
      )}
    >
      <span className={cn("h-2 w-2 shrink-0 rounded-full", severityAccent(issue.severity).dot)} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-black dark:text-white">{issue.title}</span>
        <span className="block truncate font-mono text-[11px] text-black/40 dark:text-white/40">
          {issue.method ? `${issue.method} ` : ""}{issue.route ?? "—"}
        </span>
      </span>
      <span className="hidden shrink-0 text-xs tabular-nums text-black/50 dark:text-white/50 sm:block">
        {issue.count}×
      </span>
      <span className="hidden shrink-0 text-xs text-black/40 dark:text-white/40 md:block">
        {relativeTime(issue.lastSeen)}
      </span>
      <StatusPill status={issue.status} className="shrink-0" />
      <SeverityBadge severity={issue.severity} className="hidden shrink-0 lg:inline-flex" />
    </m.button>
  );
}
