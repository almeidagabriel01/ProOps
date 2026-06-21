// apps/web/src/app/admin/observability/_components/occurrence-sparkline.tsx
"use client";

import { cn } from "@/lib/utils";
import type { ErrorOccurrence } from "@/types/observability";

// Buckets the last N occurrences into 12 columns by recency and renders bars.
export function OccurrenceSparkline({ occurrences }: { occurrences: ErrorOccurrence[] }) {
  const BUCKETS = 12;
  const counts = new Array(BUCKETS).fill(0);
  if (occurrences.length > 0) {
    const times = occurrences.map((o) => Date.parse(o.createdAt));
    const min = Math.min(...times);
    const max = Math.max(...times);
    const span = Math.max(1, max - min);
    for (const t of times) {
      const idx = Math.min(BUCKETS - 1, Math.floor(((t - min) / span) * BUCKETS));
      counts[idx] += 1;
    }
  }
  const peak = Math.max(1, ...counts);
  return (
    <div className="flex h-12 items-end gap-1">
      {counts.map((c, i) => (
        <div
          key={i}
          className={cn("flex-1 rounded-sm bg-black/70 dark:bg-white/70")}
          style={{ height: `${(c / peak) * 100}%`, minHeight: 2 }}
        />
      ))}
    </div>
  );
}
