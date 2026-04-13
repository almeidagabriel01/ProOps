"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { useTenant } from "@/providers/tenant-provider";
import {
  ensureDarkModeContrast,
  ensureLightModeContrast,
} from "@/utils/color-utils";

function resolveSafe(input: string | undefined): string {
  const v = String(input || "").trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) ? v : "#3b82f6";
}

/**
 * Returns the tenant's brand color adapted for the current theme.
 * In dark mode, lightness is raised enough for WCAG AA contrast while
 * hue + saturation (brand identity) are preserved — Material Design 3 tonal
 * palette approach.
 *
 * Uses a mounted guard to prevent hydration mismatches: next-themes resolves
 * the theme client-side (from localStorage/class) before React hydrates, so
 * resolvedTheme can differ between server and the first client render.
 * Before mount both sides return the raw safe color — no adjustment applied.
 */
export function useThemePrimaryColor(): string {
  const { tenant } = useTenant();
  const { resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  const safe = resolveSafe(tenant?.primaryColor);

  if (!mounted) return safe;

  return resolvedTheme === "dark"
    ? ensureDarkModeContrast(safe)
    : ensureLightModeContrast(safe);
}