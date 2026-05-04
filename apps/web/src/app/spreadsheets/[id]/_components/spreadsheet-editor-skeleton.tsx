export function SpreadsheetEditorSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background animate-pulse">
      {/* Top Bar: Back + Title + Save */}
      <div className="flex items-center justify-between border-b bg-card px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="h-9 w-9 rounded-xl bg-muted" />
          <div className="h-8 w-64 rounded bg-muted" />
        </div>
        <div className="h-9 w-24 rounded-xl bg-muted" />
      </div>

      {/* Toolbar */}
      <div className="border-b px-3 py-2">
        <div className="flex items-center gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-7 w-20 rounded bg-muted" />
          ))}
        </div>
      </div>

      {/* Spreadsheet Grid */}
      <div className="flex-1 min-h-0 p-3">
        <div className="h-full rounded-2xl bg-muted" />
      </div>
    </div>
  );
}
