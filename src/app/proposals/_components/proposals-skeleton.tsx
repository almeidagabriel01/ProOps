import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function ProposalsSkeleton() {
  return (
    <div className="space-y-6 flex flex-col min-h-[calc(100vh_-_180px)]">
      {/* Header / Title Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-full sm:w-44" />
      </div>

      {/* Search Bar */}
      <div className="relative w-full max-w-md">
        <Skeleton className="h-10 w-full" />
      </div>

      {/* Desktop header placeholder */}
      <div className="space-y-4">
        <div className="hidden md:grid grid-cols-7 gap-4 px-4 py-2">
          <Skeleton className="col-span-1 h-4 w-full" /> {/* Title */}
          <Skeleton className="col-span-1 h-4 w-full" /> {/* Client */}
          <Skeleton className="col-span-1 h-4 w-full" /> {/* Status */}
          <Skeleton className="col-span-1 h-4 w-full" /> {/* Environment */}
          <Skeleton className="col-span-1 h-4 w-full" /> {/* System */}
          <Skeleton className="col-span-1 h-4 w-full" /> {/* Validity */}
          <Skeleton className="col-span-1 h-4 w-full" /> {/* Actions */}
        </div>

        {/* Mobile card placeholders */}
        <div className="space-y-4 md:hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={`mobile-${i}`}
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

              <div className="mt-4 flex justify-end">
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
            </div>
          ))}
        </div>

        {/* Desktop rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={`desktop-${i}`} className="hidden md:block border-border">
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
                <Skeleton className="h-8 w-8" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
