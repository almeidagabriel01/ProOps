export function AdminSkeleton() {
  return (
    <div className="max-w-7xl mx-auto space-y-8 p-6 animate-pulse">
      {/* Header: Icon + Title + Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-muted" />
            <div className="h-9 w-64 rounded bg-muted" />
          </div>
          <div className="h-5 w-96 rounded bg-muted" />
        </div>
        <div className="flex gap-2">
          <div className="h-11 w-32 rounded-xl bg-muted" />
          <div className="h-11 w-40 rounded-xl bg-muted" />
        </div>
      </div>

      {/* Search Filter */}
      <div className="h-10 w-full max-w-md rounded-xl bg-muted" />

      {/* Tenant Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-[260px] rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
