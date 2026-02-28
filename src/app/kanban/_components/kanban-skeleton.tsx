import { Skeleton } from "@/components/ui/skeleton";

export function KanbanSkeleton() {
  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-180px)]">
      {/* Header */}
      <div>
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-4 w-96 mt-2" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 w-fit bg-muted/50 p-1 rounded-xl">
        <Skeleton className="h-10 w-32 rounded-lg" />
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 py-2">
        <Skeleton className="h-9 w-32 rounded-md" />
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Board Layout */}
      <KanbanBoardSkeleton />
    </div>
  );
}

export function KanbanBoardSkeleton() {
  return (
    <div className="flex flex-1 gap-4 overflow-hidden -mx-4 px-4 pb-4 mt-2">
      {/* Render 4 column skeletons */}
      {Array.from({ length: 4 }).map((_, colIndex) => (
        <div
          key={colIndex}
          className="flex flex-col min-w-[320px] max-w-[320px] h-full rounded-xl border border-border/50 bg-muted/20 overflow-hidden"
        >
          {/* Column Header */}
          <div className="p-4 border-b border-border/50 bg-background/50 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-3 rounded-full" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-6 rounded-full" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-5 w-24 ml-1" />
          </div>

          {/* Column Content - Cards */}
          <div className="flex-1 p-3 space-y-3 overflow-hidden">
            {Array.from({ length: 3 }).map((_, cardIndex) => (
              <div
                key={cardIndex}
                className="bg-background rounded-xl p-4 border border-border/50 shadow-sm"
              >
                {/* Card Header */}
                <div className="flex items-start justify-between mb-3">
                  <Skeleton className="h-5 w-[65%]" />
                  <Skeleton className="h-5 w-16 rounded-md" />
                </div>

                {/* Card Details */}
                <div className="flex items-center gap-2 mb-4">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                </div>

                {/* Card Footer */}
                <div className="flex items-end justify-between mt-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-3.5 w-3.5 rounded-sm" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-3.5 w-3.5 rounded-sm" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
