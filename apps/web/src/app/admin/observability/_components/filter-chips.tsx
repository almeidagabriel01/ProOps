// apps/web/src/app/admin/observability/_components/filter-chips.tsx
"use client";

import { cn } from "@/lib/utils";
import type { IssueFilters, ErrorIssueStatus, ErrorSeverity, ErrorSource } from "@/types/observability";

type Group = { key: keyof IssueFilters; options: { value: string; label: string }[] };

const GROUPS: Group[] = [
  { key: "status", options: [
    { value: "all", label: "Todos" }, { value: "unresolved", label: "Abertos" },
    { value: "resolved", label: "Resolvidos" }, { value: "ignored", label: "Ignorados" }] },
  { key: "severity", options: [
    { value: "all", label: "Toda severidade" }, { value: "critical", label: "Crítico" },
    { value: "error", label: "Erro" }, { value: "warning", label: "Alerta" }] },
  { key: "source", options: [
    { value: "all", label: "Tudo" }, { value: "functions", label: "Backend" }, { value: "web", label: "Web" }] },
];

export function FilterChips({ filters, onChange }: { filters: IssueFilters; onChange: (f: IssueFilters) => void }) {
  return (
    <div className="flex flex-wrap gap-3">
      {GROUPS.map((g) => (
        <div key={g.key} className="flex flex-wrap gap-1">
          {g.options.map((o) => {
            const active = filters[g.key] === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => onChange({ ...filters, [g.key]: o.value as ErrorIssueStatus & ErrorSeverity & ErrorSource })}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                    : "border-black/15 text-black/60 hover:border-black/40 dark:border-white/15 dark:text-white/60 dark:hover:border-white/40",
                )}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
