export function WalletsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header: Title + Balance + Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-9 w-32 rounded bg-muted" />
          <div className="h-5 w-56 rounded bg-muted" />
        </div>
        <div className="flex items-center gap-4">
          <div className="space-y-1.5 text-right">
            <div className="h-3 w-20 rounded bg-muted ml-auto" />
            <div className="h-8 w-32 rounded bg-muted" />
          </div>
          <div className="h-10 w-36 rounded-xl bg-muted" />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-muted" />
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <div className="h-10 w-32 rounded-xl bg-muted" />
        <div className="h-10 w-28 rounded-xl bg-muted" />
      </div>

      {/* Wallet Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
