"use client";

import { useSyncExternalStore } from "react";

/**
 * Matches Tailwind's `md` breakpoint. Anything below it renders the mobile
 * shell (tab bar, card lists); `md` and up keeps the desktop layout untouched.
 */
export const MOBILE_BREAKPOINT_PX = 768;

const QUERY = `(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`;

function hasMatchMedia(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

function subscribe(onChange: () => void): () => void {
  if (!hasMatchMedia()) return () => {};
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  if (!hasMatchMedia()) return false;
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Prefer plain Tailwind `md:` classes whenever CSS can express the difference.
 * Reach for this hook only where rendering both trees would be wasteful or
 * semantically wrong — navigation and `DataTable` row rendering.
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
