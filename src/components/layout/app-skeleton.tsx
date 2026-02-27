import { Skeleton } from "@/components/ui/skeleton";

export function AppSkeleton({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-card">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-background overflow-hidden">
        {/* Header Skeleton (Matches Header.tsx exactly) */}
        <header
          className="relative z-50 bg-background/80 backdrop-blur-md border-b border-border px-6 flex items-center justify-between rounded-t-[2rem] transition-all duration-300"
          style={{ height: "64px", minHeight: "64px" }}
        >
          <div className="flex items-center gap-4">
            <Skeleton className="h-9 w-56 rounded-xl" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="h-8 w-px bg-border" />
            <div className="flex items-center gap-3">
              <div className="hidden md:flex flex-col items-end gap-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-9 w-9 rounded-full" />
            </div>
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
