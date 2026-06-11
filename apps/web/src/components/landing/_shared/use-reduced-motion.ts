"use client";

import { useEffect, useState } from "react";

/**
 * Reads `prefers-reduced-motion` reactively. Used by the redesigned landing
 * sections to disable pointer-driven motion (tilt/spotlight/parallax) for users
 * who asked for reduced movement — the Lenis smooth-scroll setup already honors
 * the same preference in landing-page-client.tsx.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return reduced;
}
