import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function ServicesTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-12 gap-4 px-4 py-2">
        <Skeleton className="col-span-1 h-4 w-full" />
        <Skeleton className="col-span-4 h-4 w-full" />
        <Skeleton className="col-span-2 h-4 w-full" />
        <Skeleton className="col-span-2 h-4 w-full" />
        <Skeleton className="col-span-2 h-4 w-full" />
        <Skeleton className="col-span-1 h-4 w-full" />
      </div>

      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="border-border">
          <CardContent className="grid grid-cols-12 gap-4 items-center py-4 px-4">
            <div className="col-span-1">
              <Skeleton className="h-10 w-10 rounded-md" />
            </div>
            <div className="col-span-4">
              <Skeleton className="h-5 w-3/4 mb-1" />
            </div>
            <div className="col-span-2">
              <Skeleton className="h-4 w-3/4" />
            </div>
            <div className="col-span-2">
              <Skeleton className="h-4 w-1/2" />
            </div>
            <div className="col-span-2">
              <Skeleton className="h-4 w-2/3" />
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
