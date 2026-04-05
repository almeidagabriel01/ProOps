export function KanbanSkeleton() {
  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-180px)] animate-pulse">
      {/* Header: Title + Description */}
      <div className="space-y-2">
        <div className="h-9 w-32 rounded bg-muted" />
        <div className="h-4 w-96 rounded bg-muted" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 w-fit p-1 rounded-xl bg-muted/50">
        <div className="h-10 w-32 rounded-lg bg-muted" />
        <div className="h-10 w-36 rounded-lg bg-muted" />
      </div>

      {/* Actions Bar */}
      <div className="flex items-center gap-4">
        <div className="h-9 w-32 rounded-xl bg-muted" />
        <div className="h-4 w-48 rounded bg-muted" />
      </div>

      {/* Board: 4 Columns */}
      <KanbanBoardSkeleton />
    </div>
  );
}

export function KanbanBoardSkeleton() {
  return (
    <div className="flex flex-1 gap-4 overflow-hidden -mx-4 px-4 pb-4 mt-2">
      {Array.from({ length: 4 }).map((_, colIndex) => (
        <div
          key={colIndex}
          className="flex flex-col min-w-[320px] max-w-[320px] h-full rounded-2xl bg-muted/30 overflow-hidden"
        >
          {/* Column Header */}
          <div className="p-4 border-b border-muted/40">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-muted" />
              <div className="h-5 w-24 rounded bg-muted" />
              <div className="h-5 w-6 rounded-full bg-muted" />
            </div>
          </div>

          {/* Column Cards */}
          <div className="flex-1 p-3 space-y-3">
            {Array.from({ length: 3 }).map((_, cardIndex) => (
              <div
                key={cardIndex}
                className="h-32 rounded-2xl bg-muted"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
