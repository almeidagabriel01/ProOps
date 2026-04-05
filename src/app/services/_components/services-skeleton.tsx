export function ServicesSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header: Title + Button */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-9 w-44 rounded bg-muted" />
          <div className="h-4 w-96 rounded bg-muted" />
        </div>
        <div className="h-10 w-40 rounded-xl bg-muted" />
      </div>

      {/* Search Bar */}
      <div className="h-10 w-full max-w-md rounded-xl bg-muted" />

      {/* Table Rows */}
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[68px] rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
