"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { m as motion } from "motion/react";
import { SettingsNav } from "./settings-nav";

/**
 * Settings page chrome (title + sidebar). The title and sidebar live in the
 * persistent layout and stay stable across navigation — only the content
 * column to the right shows a loading skeleton (each section renders its own
 * skeleton locally via its `loading` state). Switching sections animates the
 * content in with a light fade/slide.
 */
const SettingsLoadingContext = React.createContext<{
  setLoading: (loading: boolean) => void;
}>({ setLoading: () => {} });

/**
 * Called by a settings section to report whether its content is still loading.
 * Kept as a stable no-op for backwards compatibility: sections still call it,
 * but the chrome no longer skeletonizes — the per-section skeleton lives in the
 * content column on its own. Safe outside the settings chrome too.
 */
export function useReportSettingsLoading(_loading: boolean): void {
  const { setLoading } = React.useContext(SettingsLoadingContext);
  React.useEffect(() => {
    setLoading(_loading);
  }, [_loading, setLoading]);
}

export function SettingsChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // No-op: the chrome stays loaded; the content column owns its skeleton.
  const setLoading = React.useCallback(() => {}, []);

  return (
    <SettingsLoadingContext.Provider value={{ setLoading }}>
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Configurações
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            Gerencie sua conta, segurança e preferências.
          </p>
        </div>
        <div className="border-t border-border/60 mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8 lg:gap-10">
          <SettingsNav />
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="min-w-0 lg:-mt-8"
          >
            {children}
          </motion.div>
        </div>
      </div>
    </SettingsLoadingContext.Provider>
  );
}
