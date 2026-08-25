"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Matches Tailwind's `md` breakpoint. Anything below it renders the mobile
 * shell (tab bar, card lists); `md` and up keeps the desktop layout untouched.
 */
export const MOBILE_BREAKPOINT_PX = 768;

function hasMatchMedia(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

/**
 * Subscribes to a CSS media query. Server snapshot is always `false`, so the
 * desktop layout is what renders before hydration.
 *
 * Prefer plain Tailwind classes whenever CSS can express the difference. Reach
 * for this only where rendering both trees would be wasteful or semantically
 * wrong — navigation, `DataTable` rows, FullCalendar props.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!hasMatchMedia()) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    if (!hasMatchMedia()) return false;
    return window.matchMedia(query).matches;
  }, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** True below Tailwind's `md` breakpoint. */
export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`);
}
