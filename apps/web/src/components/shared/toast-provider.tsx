"use client";

import { useSyncExternalStore } from "react";
import { Toaster } from "sileo";
import { useTheme } from "next-themes";

export function ToastProvider() {
  const { resolvedTheme } = useTheme();

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
    <div data-theme={currentTheme} className={currentTheme}>
      <Toaster key={currentTheme} theme={currentTheme} position="top-center" />
    </div>
  );
}
