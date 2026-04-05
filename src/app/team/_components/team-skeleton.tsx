export function TeamSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 py-8 px-4 md:px-6 animate-pulse">
      {/* Form Header: Icon + Title + Description */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-muted" />
          <div className="h-8 w-48 rounded bg-muted" />
        </div>
        <div className="h-4 w-80 rounded bg-muted" />
      </div>

      {/* Add Member Button */}
      <div className="flex justify-end">
        <div className="h-10 w-44 rounded-xl bg-muted" />
      </div>

      {/* Section Title */}
      <div className="h-7 w-40 rounded bg-muted" />

      {/* Member Cards */}
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[72px] rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
