"use client";

import { useTenant } from "@/providers/tenant-provider";
import { useThemeAdjustedColor } from "@/hooks/useThemeAdjustedColor";

/**
 * Returns the tenant's brand color adapted for the current theme.
 * In dark mode, lightness is raised enough for WCAG AA contrast while
 * hue + saturation (brand identity) are preserved — Material Design 3 tonal
 * palette approach. See `useThemeAdjustedColor` for the details.
 */
export function useThemePrimaryColor(): string {
  const { tenant } = useTenant();
  return useThemeAdjustedColor(tenant?.primaryColor);
}
