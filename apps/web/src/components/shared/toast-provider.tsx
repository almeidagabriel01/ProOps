"use client";

import { Toaster } from "sileo";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

export function ToastProvider() {
  const { resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!mounted) {
    return null;
  }

  const currentTheme = resolvedTheme === "dark" ? "dark" : "light";

  return (
    <div data-theme={currentTheme} className={currentTheme}>
      <Toaster key={currentTheme} theme={currentTheme} position="top-center" />
    </div>
  );
}
