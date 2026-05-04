export function AnalyticsSkeleton() {
  return (
    <div className="space-y-8 p-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-9 w-9 rounded-xl bg-muted" />
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-muted" />
          <div className="space-y-1.5">
            <div className="h-6 w-32 rounded bg-muted" />
            <div className="h-4 w-48 rounded bg-muted" />
          </div>
        </div>
      </div>

      {/* KPI Cards — 6 in a row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-muted" />
        ))}
      </div>

      {/* Growth + Plan distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-80 rounded-2xl bg-muted" />
        <div className="h-80 rounded-2xl bg-muted" />
      </div>

      {/* Module adoption — full width */}
      <div className="h-64 rounded-2xl bg-muted" />

      {/* Status + Niche */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-72 rounded-2xl bg-muted" />
        <div className="h-72 rounded-2xl bg-muted" />
      </div>

      {/* Leaderboard */}
      <div className="h-80 rounded-2xl bg-muted" />

      {/* Churn risk */}
      <div className="h-48 rounded-2xl bg-muted" />
    </div>
  );
}
