"use client";

import { Toaster } from "sileo";
import { useTheme } from "next-themes";

export function ToastProvider() {
  const { resolvedTheme } = useTheme();
  // Render immediately (no mount gate) so sileo's store.position is set before
  // page-load effects fire. Both SSR and initial CSR resolve to "light", so
  // there is no hydration mismatch; key remount handles theme switches.
  const currentTheme = resolvedTheme === "dark" ? "dark" : "light";

  return (
    <div data-theme={currentTheme} className={currentTheme}>
      <Toaster key={currentTheme} theme={currentTheme} position="top-center" />
    </div>
  );
}
