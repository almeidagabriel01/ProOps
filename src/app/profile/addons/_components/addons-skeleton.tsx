import { Skeleton } from "@/components/ui/skeleton";

export function AddonsSkeleton() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl space-y-8">
      {/* Header Skeleton */}
      <div className="flex items-center gap-4">
        <Skeleton className="w-10 h-10" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      {/* Plan Info Skeleton */}
      <div className="border p-6 flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-32" />
          </div>
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Toggle Skeleton */}
      <div className="flex justify-center">
        <Skeleton className="h-10 w-48" />
      </div>

      {/* Grid Skeleton */}
      <div className="grid md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="border p-6 space-y-4 bg-card">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
            <Skeleton className="h-16 w-full" />
            <div className="space-y-2 pt-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            <div className="pt-4 flex justify-between items-center">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-9 w-28" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
