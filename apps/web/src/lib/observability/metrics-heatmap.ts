// apps/web/src/lib/observability/metrics-heatmap.ts
import type { ErrorMetricWindow, ErrorSeverity } from "@/types/observability";

export interface HeatCell {
  windowId: string;
  severity: ErrorSeverity;
  total: number;
  intensity: number;
}

const DEFAULT_SEVERITIES: ErrorSeverity[] = ["critical", "error", "warning"];

export function buildHeatmap(
  windows: ErrorMetricWindow[],
  severities: ErrorSeverity[] = DEFAULT_SEVERITIES,
): HeatCell[] {
  const raw: Omit<HeatCell, "intensity">[] = [];
  for (const w of windows) {
    for (const sev of severities) {
      const total =
        (w.counters[`${sev}_functions`] || 0) + (w.counters[`${sev}_web`] || 0);
      raw.push({ windowId: w.windowId, severity: sev, total });
    }
  }
  const max = raw.reduce((m, c) => Math.max(m, c.total), 0);
  return raw.map((c) => ({ ...c, intensity: max === 0 ? 0 : c.total / max }));
}
