"use client";

export function AdminOverviewSkeleton() {
  return (
    <div className="space-y-8 p-6 animate-pulse">
      {/* Header: Back Button + Icon + Title + Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-muted" />
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-muted" />
            <div className="space-y-1.5">
              <div className="h-7 w-36 rounded bg-muted" />
              <div className="h-4 w-56 rounded bg-muted" />
            </div>
          </div>
        </div>
        <div className="h-9 w-40 rounded-xl bg-muted" />
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-muted" />
        ))}
      </div>

      {/* Table Card */}
      <div className="rounded-2xl bg-muted/40 overflow-hidden">
        {/* Table Header */}
        <div className="h-20 bg-muted/60 border-b border-muted" />
        {/* Table Rows */}
        <div className="space-y-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 border-b border-muted/30 bg-muted/20" />
          ))}
        </div>
        {/* Table Footer */}
        <div className="h-12 bg-muted/30" />
      </div>
    </div>
  );
}
