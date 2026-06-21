// apps/web/src/app/admin/observability/page.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Activity } from "lucide-react";
import { m as motion } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useErrorIssues } from "./_hooks/use-error-issues";
import { useErrorMetrics } from "./_hooks/use-error-metrics";
import { HeroMetrics } from "./_components/hero-metrics";
import { SeverityHeatmap } from "./_components/severity-heatmap";
import { IssueList } from "./_components/issue-list";
import { LiveTicker } from "./_components/live-ticker";
import { IssueDrawer } from "./_components/issue-drawer";
import { DashboardSkeleton } from "./_components/dashboard-skeleton";
import type { ErrorIssue, ErrorIssueStatus, IssueFilters } from "@/types/observability";
import { DEFAULT_ISSUE_FILTERS } from "@/types/observability";

export default function ObservabilityPage() {
  const router = useRouter();
  const [filters, setFilters] = React.useState<IssueFilters>(DEFAULT_ISSUE_FILTERS);
  const [selected, setSelected] = React.useState<ErrorIssue | null>(null);
  const { issues, isLoading, triage, errorTypes, nextCursor, loadMore } = useErrorIssues(filters);
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
    <div className="space-y-8 p-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/admin")}
            className="rounded-xl hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/20">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Observabilidade</h1>
              <p className="text-sm text-muted-foreground">
                Monitoramento de erros e eventos da plataforma
              </p>
            </div>
          </div>
        </div>

        <div className="sm:max-w-sm sm:flex-1">
          <LiveTicker latest={issues[0] ?? null} />
        </div>
      </motion.div>

      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-6">
          <HeroMetrics openIssues={openIssues} events24h={events24h} affectedTenants={affectedTenants} />
          <SeverityHeatmap windows={windows} />
          <IssueList
            issues={issues}
            filters={filters}
            errorTypes={errorTypes}
            onChange={setFilters}
            onSelect={setSelected}
            nextCursor={nextCursor}
            onLoadMore={loadMore}
          />
        </div>
      )}

      <IssueDrawer issue={selected} onClose={() => setSelected(null)} onTriage={onTriage} />
    </div>
  );
}
