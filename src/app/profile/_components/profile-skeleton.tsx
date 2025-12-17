import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ProfileSkeleton() {
    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {/* Header */}
            <div>
                <Skeleton className="h-8 w-48 mb-2" />
                <Skeleton className="h-4 w-64" />
            </div>

            {/* Profile Card */}
            <Card>
                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row items-center gap-6">
                        <Skeleton className="w-20 h-20 rounded-full" />
                        <div className="flex-1 space-y-4 w-full text-center md:text-left">
                            <div className="space-y-2">
                                <Skeleton className="h-6 w-48 mx-auto md:mx-0" />
                                <Skeleton className="h-4 w-32 mx-auto md:mx-0" />
                            </div>
                            <div className="flex items-center justify-center md:justify-start gap-2">
                                <Skeleton className="h-5 w-24 rounded-full" />
                                <Skeleton className="h-5 w-32 rounded-full" />
                            </div>
                        </div>
                        <div className="w-full md:w-auto p-4 border rounded-xl bg-muted/20">
                            <div className="flex items-center justify-between gap-8 mb-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-4 w-4" />
                            </div>
                            <div className="mb-1">
                                <Skeleton className="h-6 w-32" />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Plans Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <Skeleton className="h-7 w-32 mb-1" />
                        <Skeleton className="h-4 w-64" />
                    </div>
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-9 w-24" />
                        <Skeleton className="h-9 w-40" />
                    </div>
                </div>

                {/* Toggle */}
                <div className="py-6 flex justify-center">
                    <Skeleton className="h-10 w-64 rounded-full" />
                </div>

                {/* Plan Cards */}
                <div className="grid md:grid-cols-3 gap-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Card key={i} className="h-full">
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <Skeleton className="h-6 w-32 mb-2" />
                                        <Skeleton className="h-4 w-48" />
                                    </div>
                                    {i === 1 && <Skeleton className="h-5 w-20 rounded-full" />}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex items-baseline gap-1">
                                    <Skeleton className="h-8 w-24" />
                                    <Skeleton className="h-4 w-12" />
                                </div>
                                <Skeleton className="h-10 w-full" />
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-2/3" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}
