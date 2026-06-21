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

function LabeledSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/40 dark:text-white/40">
        {label}
      </span>
      <Select
        inputSize="sm"
        disableSort
        value={value}
        options={options}
        onChange={(e) => onChange(e.target.value)}
        className="w-full"
      />
    </label>
  );
}

export function FilterBar({ filters, errorTypes, onChange }: FilterBarProps) {
  const set = (patch: Partial<IssueFilters>) => onChange({ ...filters, ...patch });
  const active = countActive(filters);

  const errorTypeOptions = [
    { value: "all", label: "Todo tipo" },
    ...errorTypes.map((t) => ({ value: t, label: t })),
  ];

  return (
    <div className="space-y-3 rounded-xl border border-black/10 bg-white/60 p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={filters.q}
          onChange={(e) => set({ q: e.target.value })}
          placeholder="Buscar por mensagem ou rota…"
          className="h-9 flex-1"
        />
        {active > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 shrink-0 self-start sm:self-auto"
            onClick={() => onChange({ ...DEFAULT_ISSUE_FILTERS })}
          >
            Limpar filtros ({active})
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <LabeledSelect
          label="Período"
          value={filters.range}
          options={RANGE_OPTIONS}
          onChange={(v) => set({ range: v as IssueFilters["range"] })}
        />
        <LabeledSelect
          label="Ordenar"
          value={filters.sort}
          options={SORT_OPTIONS}
          onChange={(v) => set({ sort: v as IssueFilters["sort"] })}
        />
        <LabeledSelect
          label="Status"
          value={filters.status}
          options={STATUS_OPTIONS}
          onChange={(v) => set({ status: v as IssueFilters["status"] })}
        />
        <LabeledSelect
          label="Severidade"
          value={filters.severity}
          options={SEVERITY_OPTIONS}
          onChange={(v) => set({ severity: v as IssueFilters["severity"] })}
        />
        <LabeledSelect
          label="Origem"
          value={filters.source}
          options={SOURCE_OPTIONS}
          onChange={(v) => set({ source: v as IssueFilters["source"] })}
        />
        <LabeledSelect
          label="Tipo"
          value={filters.errorType}
          options={errorTypeOptions}
          onChange={(v) => set({ errorType: v })}
        />
      </div>
    </div>
  );
}
