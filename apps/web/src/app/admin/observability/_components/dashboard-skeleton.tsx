// apps/web/src/app/admin/observability/_components/dashboard-skeleton.tsx
"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { GlassCard } from "./glass-card";

export function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <GlassCard key={i} className="h-40 p-5">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="mt-4 h-20 w-full" />
        </GlassCard>
      ))}
    </div>
  );
}
