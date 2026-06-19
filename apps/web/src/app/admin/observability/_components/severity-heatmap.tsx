// apps/web/src/app/admin/observability/_components/severity-heatmap.tsx
"use client";

import { m } from "motion/react";
import { cn } from "@/lib/utils";
import { GlassCard } from "./glass-card";
import { buildHeatmap } from "@/lib/observability/metrics-heatmap";
import { severityAccent } from "@/lib/observability/issue-format";
import type { ErrorMetricWindow, ErrorSeverity } from "@/types/observability";

const SEVERITIES: ErrorSeverity[] = ["critical", "error", "warning"];
const ROW_LABEL: Record<ErrorSeverity, string> = { critical: "Crítico", error: "Erro", warning: "Alerta" };

export function SeverityHeatmap({ windows }: { windows: ErrorMetricWindow[] }) {
  const cells = buildHeatmap(windows, SEVERITIES);
  const cols = windows.length || 1;

  return (
    <GlassCard className="p-5">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/50 dark:text-white/50">
        Severidade por hora
      </h2>
      <div className="mt-4 space-y-1.5">
        {SEVERITIES.map((sev) => (
          <div key={sev} className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-right text-[11px] text-black/40 dark:text-white/40">
              {ROW_LABEL[sev]}
            </span>
            <div
              className="grid flex-1 gap-1"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            >
              {cells
                .filter((c) => c.severity === sev)
                .map((c) => (
                  <m.div
                    key={c.windowId}
                    title={`${c.total} eventos`}
                    whileHover={{ scale: 1.18, transition: { type: "spring", stiffness: 400, damping: 18 } }}
                    className={cn("h-6 rounded-[4px] border border-black/5 dark:border-white/5", severityAccent(sev).dot)}
                    style={{ opacity: 0.12 + c.intensity * 0.88 }}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
