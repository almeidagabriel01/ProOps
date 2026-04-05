export function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header: Greeting + Balance */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div className="space-y-2">
          <div className="h-9 w-72 rounded bg-muted" />
          <div className="h-4 w-40 rounded bg-muted" />
        </div>
        <div className="flex items-center gap-4">
          <div className="space-y-1.5 text-right">
            <div className="h-3 w-20 rounded bg-muted ml-auto" />
            <div className="h-8 w-32 rounded bg-muted" />
          </div>
        </div>
      </div>

      {/* Alerts Card */}
      <div className="h-20 rounded-2xl bg-muted" />

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-muted" />
        ))}
      </div>

      {/* Charts: Cash Flow + Future Balance */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="h-[380px] rounded-2xl bg-muted" />
        <div className="h-[380px] rounded-2xl bg-muted" />
      </div>

      {/* Recent Proposals + Month Stats */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="h-72 rounded-2xl bg-muted" />
        <div className="h-72 rounded-2xl bg-muted" />
      </div>

      {/* Stats: Proposals + Clients */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="h-64 rounded-2xl bg-muted" />
        <div className="h-64 rounded-2xl bg-muted" />
      </div>

      {/* Recent Transactions */}
      <div className="h-72 rounded-2xl bg-muted" />
    </div>
  );
}
