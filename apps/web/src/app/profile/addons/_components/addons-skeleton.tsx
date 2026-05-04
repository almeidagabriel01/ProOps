export function AddonsSkeleton() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl space-y-8 animate-pulse">
      {/* Header: Back + Title */}
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-xl bg-muted" />
        <div className="space-y-2">
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="h-4 w-64 rounded bg-muted" />
        </div>
      </div>

      {/* Plan Info Bar */}
      <div className="h-16 rounded-2xl bg-muted" />

      {/* Monthly/Yearly Toggle */}
      <div className="flex justify-center">
        <div className="h-10 w-48 rounded-xl bg-muted" />
      </div>

      {/* Addon Cards Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-52 rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
