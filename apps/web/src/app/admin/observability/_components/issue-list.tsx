// apps/web/src/app/admin/observability/_components/issue-list.tsx
"use client";

import { AnimatePresence, m } from "motion/react";
import { GlassCard } from "./glass-card";
import { FilterBar } from "./filter-bar";
import { IssueRow } from "./issue-row";
import { Button } from "@/components/ui/button";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import type { ErrorIssue, IssueFilters } from "@/types/observability";

interface IssueListProps {
  issues: ErrorIssue[];
  filters: IssueFilters;
  errorTypes: string[];
  onChange: (f: IssueFilters) => void;
  onSelect: (i: ErrorIssue) => void;
  nextCursor: string | null;
  onLoadMore: () => void;
}

export function IssueList({
  issues,
  filters,
  errorTypes,
  onChange,
  onSelect,
  nextCursor,
  onLoadMore,
}: IssueListProps) {
  const reduced = usePrefersReducedMotion();
  return (
    <GlassCard className="p-5">
      <div className="flex flex-col gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/50 dark:text-white/50">
          Issues ({issues.length})
        </h2>
        <FilterBar filters={filters} errorTypes={errorTypes} onChange={onChange} />
      </div>
      <div className="mt-3 flex flex-col">
        {issues.length === 0 && (
          <p className="py-10 text-center text-sm text-black/40 dark:text-white/40">Nenhuma issue.</p>
        )}
        <AnimatePresence initial={false}>
          {issues.map((issue) => (
            <m.div
              key={issue.fingerprint}
              layout={!reduced}
              initial={reduced ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
              transition={{ duration: 0.18 }}
            >
              <IssueRow issue={issue} onSelect={onSelect} />
            </m.div>
          ))}
        </AnimatePresence>
      </div>
      {nextCursor && (
        <div className="mt-3 flex justify-center">
          <Button variant="outline" size="sm" onClick={onLoadMore}>
            Carregar mais
          </Button>
        </div>
      )}
    </GlassCard>
  );
}
