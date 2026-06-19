// apps/web/src/app/admin/observability/page.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { useErrorIssues } from "./_hooks/use-error-issues";
import { useErrorMetrics } from "./_hooks/use-error-metrics";
import { HeroMetrics } from "./_components/hero-metrics";
import { SeverityHeatmap } from "./_components/severity-heatmap";
import { IssueList } from "./_components/issue-list";
import { LiveTicker } from "./_components/live-ticker";
import { IssueDrawer } from "./_components/issue-drawer";
import { DashboardSkeleton } from "./_components/dashboard-skeleton";
import type { ErrorIssue, ErrorIssueStatus, IssueFilters } from "@/types/observability";

export default function ObservabilityPage() {
  const [filters, setFilters] = React.useState<IssueFilters>({ status: "all", severity: "all", source: "all" });
  const [selected, setSelected] = React.useState<ErrorIssue | null>(null);
  const { issues, isLoading, triage } = useErrorIssues(filters);
  const { windows } = useErrorMetrics(24);

  const openIssues = React.useMemo(() => issues.filter((i) => i.status === "unresolved").length, [issues]);
  const events24h = React.useMemo(
    () => windows.reduce((sum, w) => sum + Object.values(w.counters).reduce((a, b) => a + b, 0), 0),
    [windows],
  );
  const affectedTenants = React.useMemo(
    () => issues.reduce((max, i) => Math.max(max, i.affectedTenants), 0),
    [issues],
  );

  const onTriage = React.useCallback(
    async (fp: string, status: ErrorIssueStatus) => {
      try {
        await triage(fp, status);
        toast.success("Issue atualizada");
        setSelected((prev) => (prev && prev.fingerprint === fp ? { ...prev, status } : prev));
      } catch {
        toast.error("Falha ao atualizar issue");
      }
    },
    [triage],
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6 flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-black dark:text-white">Observabilidade</h1>
        <LiveTicker latest={issues[0] ?? null} />
      </header>

      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-4">
          <HeroMetrics openIssues={openIssues} events24h={events24h} affectedTenants={affectedTenants} />
          <SeverityHeatmap windows={windows} />
          <IssueList issues={issues} filters={filters} onChange={setFilters} onSelect={setSelected} />
        </div>
      )}

      <IssueDrawer issue={selected} onClose={() => setSelected(null)} onTriage={onTriage} />
    </div>
  );
}
