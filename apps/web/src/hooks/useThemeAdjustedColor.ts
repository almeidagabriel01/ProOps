"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import {
  ensureDarkModeContrast,
  ensureLightModeContrast,
  normalizeHex,
} from "@/utils/color-utils";

const FALLBACK_COLOR = "#3b82f6";

/**
 * Returns a brand color adapted for the current theme, so it stays readable
 * as text, icon or border. In dark mode lightness is raised (black becomes a
 * light gray); in light mode it is lowered (white becomes a dark gray). Hue and
 * saturation are preserved, and colors that already contrast are unchanged.
 *
 * Use it for any color the tenant chose that ends up painted on the ERP
 * surface. The PDF is printed on white paper and must keep the raw color.
 *
 * Uses a mounted guard to prevent hydration mismatches: next-themes resolves
 * the theme client-side before React hydrates, so resolvedTheme can differ
 * between server and the first client render. Before mount both sides return
 * the normalized raw color.
 */
export function useThemeAdjustedColor(input: string | null | undefined): string {
  const { resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const safe = normalizeHex(input) ?? FALLBACK_COLOR;

  if (!mounted) return safe;

  return resolvedTheme === "dark"
    ? ensureDarkModeContrast(safe)
    : ensureLightModeContrast(safe);
}
