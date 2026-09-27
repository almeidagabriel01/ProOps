"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { Toaster } from "sileo";
import { useTheme } from "next-themes";
import { observeToastAccessibility } from "@/lib/toast-a11y";

export function ToastProvider() {
  const { resolvedTheme } = useTheme();
  const rootRef = useRef<HTMLDivElement>(null);

  // O sileo aninha a ação dentro de um <button>; ver lib/toast-a11y.ts.
  useEffect(() => {
    if (!rootRef.current) return;
    return observeToastAccessibility(rootRef.current);
  }, []);

  // SSR-safe mount detection: server snapshot returns false, client returns true.
  // Avoids setState-in-effect pattern and correctly handles SSR/hydration.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Before mount, fall back to "light" so SSR and initial hydration match.
  // After mount the correct stored theme is applied and Toaster remounts via key.
  const currentTheme = mounted && resolvedTheme === "dark" ? "dark" : "light";

  return (
    <div ref={rootRef} data-theme={currentTheme} className={currentTheme}>
      <Toaster key={currentTheme} theme={currentTheme} position="top-center" />
    </div>
  );
}
