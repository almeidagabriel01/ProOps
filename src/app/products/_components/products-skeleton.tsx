import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function ProductsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header / Title Actions */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Skeleton className="h-10 w-full" />
      </div>

      {/* Grid Table */}
      <div className="space-y-4">
        {/* Header Row */}
        <div className="grid grid-cols-12 gap-4 px-4 py-2">
          <Skeleton className="col-span-1 h-4 w-full" /> {/* Image */}
          <Skeleton className="col-span-4 h-4 w-full" /> {/* Name */}
          <Skeleton className="col-span-2 h-4 w-full" /> {/* Category */}
          <Skeleton className="col-span-2 h-4 w-full" /> {/* SKU */}
          <Skeleton className="col-span-1 h-4 w-full" /> {/* Stock */}
          <Skeleton className="col-span-1 h-4 w-full" /> {/* Price */}
          <Skeleton className="col-span-1 h-4 w-full" /> {/* Actions */}
        </div>

        {/* Data Rows */}
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="border-border">
            <CardContent className="grid grid-cols-12 gap-4 items-center py-4 px-4">
              <div className="col-span-1">
                <Skeleton className="h-10 w-10" />
              </div>
              <div className="col-span-4">
                <Skeleton className="h-5 w-3/4 mb-1" />
              </div>
              <div className="col-span-2">
                <Skeleton className="h-4 w-1/2" />
              </div>
              <div className="col-span-2">
                <Skeleton className="h-4 w-2/3" />
              </div>
              <div className="col-span-1">
                <Skeleton className="h-4 w-1/2" />
              </div>
              <div className="col-span-1">
                <Skeleton className="h-4 w-3/4" />
              </div>
              <div className="col-span-1 flex justify-end gap-1">
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
