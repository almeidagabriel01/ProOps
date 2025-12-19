import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function TeamSkeleton() {
    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-48" />
                </div>
                <Skeleton className="h-4 w-64" />
            </div>

            {/* Create Member */}
            <Card>
                <CardContent className="p-6 space-y-4">
                    <Skeleton className="h-6 w-32" />
                    <div className="grid md:grid-cols-2 gap-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="space-y-2">
                                <Skeleton className="h-4 w-16" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        ))}
                        <div className="flex items-end">
                            <Skeleton className="h-10 w-full" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Members List */}
            <div className="space-y-4">
                <Skeleton className="h-6 w-32" />
                {Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i}>
                        <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Skeleton className="w-10 h-10 rounded-full" />
                                <div>
                                    <Skeleton className="h-4 w-32 mb-1" />
                                    <div className="flex gap-2">
                                        <Skeleton className="h-3 w-24" />
                                        <Skeleton className="h-3 w-16" />
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Skeleton className="h-8 w-8 rounded-full" />
                                <Skeleton className="h-8 w-20 rounded-md" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
