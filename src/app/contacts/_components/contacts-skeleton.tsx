export function ContactsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header: Title + Button */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-9 w-56 rounded bg-muted" />
          <div className="h-4 w-72 rounded bg-muted" />
        </div>
        <div className="h-10 w-36 rounded-xl bg-muted" />
      </div>

      {/* Search + Filter Tabs */}
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="h-10 w-full max-w-md rounded-xl bg-muted" />
        <div className="flex gap-2">
          <div className="h-9 w-[68px] rounded-lg bg-muted" />
          <div className="h-9 w-[95px] rounded-lg bg-muted" />
          <div className="h-9 w-[124px] rounded-lg bg-muted" />
        </div>
      </div>

      {/* Table Rows */}
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-[72px] rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
