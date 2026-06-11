"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(callback: () => void): () => void {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Reads `prefers-reduced-motion` reactively via useSyncExternalStore (no
 * setState-in-effect, SSR-safe). Used by the redesigned landing sections to
 * disable pointer-driven motion (tilt/spotlight/parallax) for users who asked
 * for reduced movement — the Lenis smooth-scroll setup honors the same
 * preference in landing-page-client.tsx.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
