"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function AdminOverviewSkeleton() {
    return (
        <div className="space-y-8 p-6">
            {/* Page Header Skeleton */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-xl" />
                        <div className="space-y-2">
                            <Skeleton className="h-7 w-36" />
                            <Skeleton className="h-4 w-56" />
                        </div>
                    </div>
                </div>
                <Skeleton className="h-9 w-40 rounded-md" />
            </div>

            {/* Metrics Cards Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div
                        key={i}
                        className="relative overflow-hidden rounded-2xl p-6 bg-muted/50"
                    >
                        <div className="flex items-start justify-between">
                            <div className="space-y-3 flex-1">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-10 w-20" />
                                <Skeleton className="h-3 w-32" />
                            </div>
                            <Skeleton className="h-12 w-12 rounded-xl" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Table Card Skeleton */}
            <div className="rounded-xl border bg-card/50 overflow-hidden">
                {/* Card Header */}
                <div className="px-6 py-5 border-b">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-2">
                            <Skeleton className="h-5 w-48" />
                            <Skeleton className="h-4 w-72" />
                        </div>
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-10 w-64 rounded-xl" />
                            <Skeleton className="h-10 w-32 rounded-xl" />
                        </div>
                    </div>
                </div>
                {/* Table Body */}
                <div className="p-0">
                    <div className="space-y-0">
                        {/* Header Row */}
                        <div className="flex items-center px-6 py-4 border-b bg-muted/30">
                            <Skeleton className="h-4 w-24 mr-auto" />
                            <Skeleton className="h-4 w-16 mx-4" />
                            <Skeleton className="h-4 w-16 mx-4" />
                            <Skeleton className="h-4 w-16 mx-4" />
                            <Skeleton className="h-4 w-16 mx-4" />
                            <Skeleton className="h-4 w-12 ml-4" />
                        </div>
                        {/* Data Rows */}
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="flex items-center px-6 py-4 border-b">
                                <div className="flex items-center gap-3 mr-auto">
                                    <Skeleton className="h-10 w-10 rounded-full" />
                                    <div className="space-y-1.5">
                                        <Skeleton className="h-4 w-32" />
                                        <Skeleton className="h-3 w-40" />
                                    </div>
                                </div>
                                <Skeleton className="h-6 w-20 rounded-full mx-4" />
                                <Skeleton className="h-4 w-12 mx-4" />
                                <Skeleton className="h-4 w-12 mx-4" />
                                <Skeleton className="h-4 w-12 mx-4" />
                                <Skeleton className="h-6 w-16 rounded-full mx-4" />
                                <Skeleton className="h-8 w-8 rounded-lg" />
                            </div>
                        ))}
                    </div>
                </div>
                {/* Card Footer */}
                <div className="px-6 py-4 border-t bg-muted/20 flex items-center justify-between">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-36" />
                </div>
            </div>
        </div>
    );
}
