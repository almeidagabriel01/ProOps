import { Skeleton } from "@/components/ui/skeleton";
import { COLLAPSED_WIDTH, EXPANDED_WIDTH } from "@/components/layout/sidebar";

export function AppSkeleton({ children, showSidebar = true }: { children?: React.ReactNode, showSidebar?: boolean }) {
    // Default to collapsed width for loading state to minimize layout shift if user hovers immediately
    // or just mimic the default initial state
    const sidebarWidth = showSidebar ? COLLAPSED_WIDTH : 0;

    return (
        <div className="flex h-screen overflow-hidden bg-card">
            {/* Sidebar Skeleton */}
            {showSidebar && (
                <div
                    style={{ width: sidebarWidth }}
                    className="fixed mt-1 left-0 top-0 h-screen bg-card flex flex-col z-50 border-r border-border"
                >
                    {/* Logo area */}
                    <div className="px-4 py-4 flex items-center gap-3 border-b border-border h-16 min-h-16">
                        <Skeleton className="w-10 h-10 rounded-lg" />
                    </div>

                    {/* Nav items */}
                    <div className="flex-1 p-3 space-y-2 mt-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Skeleton key={i} className="h-10 w-full rounded-lg" />
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="p-3 border-t border-border">
                        <Skeleton className="h-10 w-full rounded-lg" />
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div
                className="flex-1 flex flex-col transition-all duration-300 ease-in-out bg-background rounded-l-[2rem] my-1 mr-1"
                style={{ marginLeft: sidebarWidth }}
            >
                {/* Header Skeleton */}
                <header className="h-16 border-b border-border/40 px-8 flex items-center justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 rounded-tl-[2rem]">
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-8 w-64" />
                    </div>
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-9 w-9 rounded-full" />
                        <Skeleton className="h-9 w-9 rounded-full" />
                        <Skeleton className="h-8 w-8 rounded-full" />
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 mt-0 p-8 overflow-y-auto">
                    {children || <div className="space-y-4">
                        <Skeleton className="h-8 w-1/3" />
                        <Skeleton className="h-64 w-full" />
                    </div>}
                </main>
            </div>
        </div>
    );
}
