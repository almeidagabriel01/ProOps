// apps/web/src/app/admin/observability/_components/hero-metrics.tsx
"use client";

import { m } from "motion/react";
import { GlassCard } from "./glass-card";
import { useCountUp } from "@/hooks/use-count-up";

function Stat({ label, value }: { label: string; value: number }) {
  const v = useCountUp(value);
  return (
    <GlassCard className="flex flex-col justify-between p-5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/50 dark:text-white/50">
        {label}
      </span>
      <m.span className="mt-3 text-5xl font-bold tabular-nums tracking-tight text-black dark:text-white">
        {v}
      </m.span>
    </GlassCard>
  );
}

export function HeroMetrics({
  openIssues,
  events24h,
  affectedTenants,
}: {
  openIssues: number;
  events24h: number;
  affectedTenants: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Stat label="Issues abertas" value={openIssues} />
      <Stat label="Eventos / 24h" value={events24h} />
      <Stat label="Tenants afetados" value={affectedTenants} />
    </div>
  );
}
