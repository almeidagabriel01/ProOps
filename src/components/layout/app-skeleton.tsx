import { Skeleton } from "@/components/ui/skeleton";

export function AppSkeleton({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-card">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col transition-all duration-300 ease-in-out bg-background m-1 overflow-hidden">
        {/* Header Skeleton */}
        <header className="h-16 border-b border-border/40 px-8 flex items-center justify-between bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-64" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-8 w-8" />
          </div>
        </header>

        {/* Page Content */}
        <main
          id="main-content"
          className="flex-1 mt-0 p-8 pb-28 overflow-y-auto"
        >
          {children || (
            <div className="space-y-4">
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-64 w-full" />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
