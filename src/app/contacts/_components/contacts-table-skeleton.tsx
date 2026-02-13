import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function ContactsTableSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header Row */}
      <div className="grid grid-cols-12 gap-4 px-4 py-2">
        <Skeleton className="col-span-3 h-4 w-full" /> {/* Name */}
        <Skeleton className="col-span-3 h-4 w-full" /> {/* Contact */}
        <Skeleton className="col-span-2 h-4 w-full" /> {/* Source */}
        <Skeleton className="col-span-2 h-4 w-full" /> {/* Registered */}
        <Skeleton className="col-span-2 h-4 w-full" /> {/* Actions */}
      </div>

      {/* Data Rows */}
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className="border-border">
          <CardContent className="grid grid-cols-12 gap-4 items-center py-4 px-4">
            <div className="col-span-3">
              <Skeleton className="h-5 w-3/4 mb-1" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <div className="col-span-3 space-y-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <div className="col-span-2">
              <Skeleton className="h-6 w-20" />
            </div>
            <div className="col-span-2">
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="col-span-2 flex justify-end gap-1">
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
