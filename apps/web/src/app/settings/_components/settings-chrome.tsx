"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsNav } from "./settings-nav";
import { SettingsNavSkeleton } from "./settings-skeleton";

/**
 * Settings page chrome (title + sidebar) that turns into a skeleton while the
 * active section is loading its data. The title/sidebar live in the persistent
 * layout, so without this the chrome stayed "loaded" while only the content
 * column showed a skeleton. Each section reports its loading state via
 * `useReportSettingsLoading`, and the chrome reflects it — giving one cohesive
 * loading state across the whole /settings page.
 */
const SettingsLoadingContext = React.createContext<{
  setLoading: (loading: boolean) => void;
}>({ setLoading: () => {} });

/**
 * Called by a settings section to report whether its content is still loading.
 * No-ops outside the settings chrome (default context), so components shared
 * with other routes (e.g. TeamManagement on legacy /team) stay safe.
 */
export function useReportSettingsLoading(loading: boolean): void {
  const { setLoading } = React.useContext(SettingsLoadingContext);
  React.useEffect(() => {
    setLoading(loading);
  }, [loading, setLoading]);
  // Reset when the section unmounts so a tab switch never leaves a stale state.
  React.useEffect(() => {
    return () => setLoading(false);
  }, [setLoading]);
}

export function SettingsChrome({ children }: { children: React.ReactNode }) {
  // Start in the loading state so the first paint is the cohesive skeleton; the
  // active section then reports its real loading state on mount.
  const [isLoading, setIsLoading] = React.useState(true);
  const setLoading = React.useCallback(
    (loading: boolean) => setIsLoading(loading),
    [],
  );

  return (
    <SettingsLoadingContext.Provider value={{ setLoading }}>
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-48 sm:h-9 sm:w-56" />
              <Skeleton className="h-4 w-72" />
            </div>
          ) : (
            <>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Configurações
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base mt-1">
                Gerencie sua conta, segurança e preferências.
              </p>
            </>
          )}
        </div>
        <div className="border-t border-border/60 mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8 lg:gap-10">
          {isLoading ? <SettingsNavSkeleton /> : <SettingsNav />}
          <div className="min-w-0 lg:-mt-8">{children}</div>
        </div>
      </div>
    </SettingsLoadingContext.Provider>
  );
}
