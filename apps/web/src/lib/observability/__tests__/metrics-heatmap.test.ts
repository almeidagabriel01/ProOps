// apps/web/src/lib/observability/__tests__/metrics-heatmap.test.ts
import { describe, it, expect } from "vitest";
import { buildHeatmap } from "../metrics-heatmap";
import type { ErrorMetricWindow } from "@/types/observability";

const windows: ErrorMetricWindow[] = [
  { windowId: "2026061910", windowStart: "2026-06-19T10:00:00.000Z", counters: { critical_functions: 4, critical_web: 1, warning_web: 2 } },
  { windowId: "2026061911", windowStart: "2026-06-19T11:00:00.000Z", counters: { error_functions: 1 } },
];

describe("buildHeatmap", () => {
  it("sums a severity across both sources per window", () => {
    const cells = buildHeatmap(windows, ["critical", "error", "warning"]);
    const c = cells.find((x) => x.windowId === "2026061910" && x.severity === "critical");
    expect(c!.total).toBe(5); // 4 functions + 1 web
  });

  it("normalizes intensity to the max total (0..1)", () => {
    const cells = buildHeatmap(windows, ["critical", "error", "warning"]);
    const max = Math.max(...cells.map((c) => c.total));
    const top = cells.find((c) => c.total === max)!;
    expect(top.intensity).toBe(1);
    const zero = cells.find((c) => c.total === 0)!;
    expect(zero.intensity).toBe(0);
  });

  it("produces windows.length * severities.length cells", () => {
    const cells = buildHeatmap(windows, ["critical", "error", "warning"]);
    expect(cells.length).toBe(6);
  });
});
