import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function ProposalsTableSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header Row */}
      <div className="hidden md:grid grid-cols-7 gap-4 px-4 py-2">
        <Skeleton className="col-span-1 h-4 w-full" /> {/* Title */}
        <Skeleton className="col-span-1 h-4 w-full" /> {/* Client */}
        <Skeleton className="col-span-1 h-4 w-full" /> {/* Status */}
        <Skeleton className="col-span-1 h-4 w-full" /> {/* Environment */}
        <Skeleton className="col-span-1 h-4 w-full" /> {/* System */}
        <Skeleton className="col-span-1 h-4 w-full" /> {/* Validity */}
        <Skeleton className="col-span-1 h-4 w-full" /> {/* Actions */}
      </div>

      {/* Mobile cards */}
      <div className="space-y-4 md:hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={`mobile-row-${i}`}
            className="rounded-xl border border-border bg-card px-4 py-4"
          >
            <div className="space-y-2">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>

            <div className="mt-4 space-y-3">
              <div className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-2/3" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-6 w-28 rounded-full" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-2/3" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </div>
        ))}
      </div>

      {/* Data Rows */}
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="hidden md:block border-border">
          <CardContent className="grid grid-cols-7 gap-4 items-center py-4 px-4">
            <div className="col-span-1">
              <Skeleton className="h-5 w-3/4 mb-1" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <div className="col-span-1">
              <Skeleton className="h-4 w-3/4" />
            </div>
            <div className="col-span-1">
              <Skeleton className="h-6 w-24" />
            </div>
            <div className="col-span-1">
              <Skeleton className="h-4 w-1/2" />
            </div>
            <div className="col-span-1">
              <Skeleton className="h-4 w-1/2" />
            </div>
            <div className="col-span-1">
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="col-span-1 flex justify-end gap-1">
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
