import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function CustomersEmptySkeleton() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-9 w-32" />
                    <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-10 w-36" />
            </div>

            {/* Search Bar Placeholder */}
            <div className="relative max-w-md">
                <Skeleton className="h-10 w-full" />
            </div>

            {/* Empty Card */}
            <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                    <Skeleton className="w-16 h-16 rounded-full mb-4" />
                    <Skeleton className="h-6 w-48 mb-2" />
                    <Skeleton className="h-4 w-64 mb-6" />
                    <Skeleton className="h-10 w-48" />
                </CardContent>
            </Card>
        </div>
    );
}
