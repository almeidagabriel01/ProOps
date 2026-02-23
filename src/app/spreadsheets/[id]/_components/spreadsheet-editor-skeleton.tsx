import { Skeleton } from "@/components/ui/skeleton";

export function SpreadsheetEditorSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex items-center justify-between border-b bg-card px-4 py-3">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-md" />
          <div className="flex flex-col">
            <Skeleton className="h-8 w-64 rounded-md" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden bg-white">
        <div className="flex h-full w-full flex-col">
          <div className="border-b px-3 py-2">
            <div className="flex items-center gap-2 overflow-hidden">
              <Skeleton className="h-7 w-16 rounded-sm" />
              <Skeleton className="h-7 w-28 rounded-sm" />
              <Skeleton className="h-7 w-20 rounded-sm" />
              <Skeleton className="h-7 w-24 rounded-sm" />
              <Skeleton className="h-7 w-16 rounded-sm" />
              <Skeleton className="h-7 w-20 rounded-sm" />
            </div>
          </div>

          <div className="flex-1 min-h-0 px-3 py-2">
            <div className="grid h-full min-h-0 grid-cols-[44px_1fr] gap-2">
              <div className="space-y-2 py-1">
                {Array.from({ length: 22 }).map((_, i) => (
                  <Skeleton key={`row-${i}`} className="h-4 w-10 rounded-sm" />
                ))}
              </div>

              <div className="grid h-full grid-cols-10 gap-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={`col-${i}`} className="h-6 w-full rounded-sm" />
                ))}
                {Array.from({ length: 170 }).map((_, i) => (
                  <Skeleton key={`cell-${i}`} className="h-6 w-full rounded-sm" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
