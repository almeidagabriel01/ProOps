"use client";

import { Toaster } from "sileo";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";

export function ToastProvider() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Before mount, fall back to "light" so SSR and initial hydration match.
  // After mount the correct stored theme is applied and Toaster remounts via key.
  const currentTheme = mounted && resolvedTheme === "dark" ? "dark" : "light";

  return (
    <div data-theme={currentTheme} className={currentTheme}>
      <Toaster key={currentTheme} theme={currentTheme} position="top-center" />
    </div>
  );
}
