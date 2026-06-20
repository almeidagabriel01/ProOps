"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DEFAULT_ISSUE_FILTERS } from "@/types/observability";
import type { IssueFilters } from "@/types/observability";

interface FilterBarProps {
  filters: IssueFilters;
  errorTypes: string[];
  onChange: (next: IssueFilters) => void;
}

function countActive(f: IssueFilters): number {
  let n = 0;
  if (f.status !== "all") n++;
  if (f.severity !== "all") n++;
  if (f.source !== "all") n++;
  if (f.errorType !== "all") n++;
  if (f.q.trim()) n++;
  if (f.range !== "all") n++;
  if (f.sort !== "recent") n++;
  return n;
}

const RANGE_OPTIONS = [
  { value: "all", label: "Todo período" },
  { value: "1h", label: "Última 1h" },
  { value: "24h", label: "Últimas 24h" },
  { value: "7d", label: "Últimos 7d" },
  { value: "30d", label: "Últimos 30d" },
];

const SORT_OPTIONS = [
  { value: "recent", label: "Mais recentes" },
  { value: "frequent", label: "Mais frequentes" },
  { value: "newest", label: "Mais novos" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "Todos status" },
  { value: "unresolved", label: "Abertos" },
  { value: "resolved", label: "Resolvidos" },
  { value: "ignored", label: "Ignorados" },
];

const SEVERITY_OPTIONS = [
  { value: "all", label: "Toda severidade" },
  { value: "critical", label: "Crítico" },
  { value: "error", label: "Erro" },
  { value: "warning", label: "Alerta" },
];

const SOURCE_OPTIONS = [
  { value: "all", label: "Toda origem" },
  { value: "web", label: "Web" },
  { value: "functions", label: "Backend" },
];

export function FilterBar({ filters, errorTypes, onChange }: FilterBarProps) {
  const set = (patch: Partial<IssueFilters>) => onChange({ ...filters, ...patch });
  const active = countActive(filters);

  const errorTypeOptions = [
    { value: "all", label: "Todo tipo" },
    ...errorTypes.map((t) => ({ value: t, label: t })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <Input
        value={filters.q}
        onChange={(e) => set({ q: e.target.value })}
        placeholder="Buscar por mensagem ou rota…"
        className="h-9 w-full sm:w-64"
      />

      <Select
        inputSize="sm"
        disableSort
        value={filters.range}
        options={RANGE_OPTIONS}
        onChange={(e) => set({ range: e.target.value as IssueFilters["range"] })}
        className="w-32"
      />

      <Select
        inputSize="sm"
        disableSort
        value={filters.sort}
        options={SORT_OPTIONS}
        onChange={(e) => set({ sort: e.target.value as IssueFilters["sort"] })}
        className="w-40"
      />

      <Select
        inputSize="sm"
        disableSort
        value={filters.status}
        options={STATUS_OPTIONS}
        onChange={(e) => set({ status: e.target.value as IssueFilters["status"] })}
        className="w-36"
      />

      <Select
        inputSize="sm"
        disableSort
        value={filters.severity}
        options={SEVERITY_OPTIONS}
        onChange={(e) => set({ severity: e.target.value as IssueFilters["severity"] })}
        className="w-36"
      />

      <Select
        inputSize="sm"
        disableSort
        value={filters.source}
        options={SOURCE_OPTIONS}
        onChange={(e) => set({ source: e.target.value as IssueFilters["source"] })}
        className="w-32"
      />

      <Select
        inputSize="sm"
        disableSort
        value={filters.errorType}
        options={errorTypeOptions}
        onChange={(e) => set({ errorType: e.target.value })}
        className="w-40"
      />

      {active > 0 && (
        <Button variant="ghost" size="sm" className="h-9" onClick={() => onChange({ ...DEFAULT_ISSUE_FILTERS })}>
          Limpar ({active})
        </Button>
      )}
    </div>
  );
}
