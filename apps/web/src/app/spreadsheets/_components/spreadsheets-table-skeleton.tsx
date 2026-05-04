import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function SpreadsheetsTableSkeleton() {
  return (
    <div className="overflow-x-auto">
      <div className="flex flex-1 flex-col gap-4" style={{ minWidth: "600px" }}>
        <div className="grid grid-cols-12 gap-4 border border-transparent px-4 py-2 text-sm font-medium text-muted-foreground">
          <div className="col-span-6 flex items-center">
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="col-span-3 flex items-center">
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="col-span-3 flex items-center justify-end">
            <Skeleton className="h-4 w-16" />
          </div>
        </div>

        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="transition-colors hover:bg-muted/50">
            <CardContent className="grid grid-cols-12 items-center gap-4 px-4 py-4">
              <div className="col-span-6 flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-md" />
                <Skeleton className="h-5 w-56" />
              </div>

              <div className="col-span-3">
                <Skeleton className="h-4 w-24" />
              </div>

              <div className="col-span-3 flex justify-end gap-1">
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
