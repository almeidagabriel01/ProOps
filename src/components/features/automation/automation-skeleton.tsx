import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export function AutomationSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-10" /> {/* Icon */}
            <Skeleton className="h-8 w-48" /> {/* Title */}
          </div>
          <Skeleton className="h-5 w-96 ml-12" /> {/* Description */}
        </div>
      </div>

      {/* Tabs and Content */}
      <div className="space-y-6">
        {/* Tabs List */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-40" />
          </div>

          {/* New System Button */}
          <Skeleton className="h-10 w-40" />
        </div>

        {/* Content List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* Simulate a list of systems */}
          {Array.from({ length: 8 }).map((_, i) => (
            <Card
              key={i}
              className="bg-card border shadow-sm overflow-hidden h-[200px] flex flex-col"
            >
              <div className="p-6 space-y-4 flex-1">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3 w-full">
                    <Skeleton className="h-10 w-10 shrink-0" />
                    <div className="space-y-2 w-full">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Skeleton className="h-5 w-24" />
                  <div className="flex gap-1">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </div>

                <Skeleton className="h-9 w-full mt-auto" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
