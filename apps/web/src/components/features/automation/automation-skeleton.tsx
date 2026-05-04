export function AutomationSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header: Icon + Title + Description */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-muted" />
          <div className="h-8 w-48 rounded bg-muted" />
        </div>
        <div className="h-5 w-96 rounded bg-muted ml-12" />
      </div>

      {/* Tabs + New Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
        <div className="flex gap-2">
          <div className="h-10 w-32 rounded-lg bg-muted" />
          <div className="h-10 w-40 rounded-lg bg-muted" />
        </div>
        <div className="h-10 w-40 rounded-xl bg-muted" />
      </div>

      {/* Content Grid: System/Environment Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-[200px] rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
