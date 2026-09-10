"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A media query, read reactively and without a setState in an effect.
 *
 * Same shape as `use-reduced-motion.ts`, generalised. `useSyncExternalStore` is
 * what makes it SSR-safe AND lint-clean: the server snapshot is always `false`,
 * so the first client render matches the server and there is no hydration
 * mismatch, and the subscription updates without a render-then-set dance.
 *
 * `false` on the server means every caller has to be written so that "not
 * matching" is a correct page, not a broken one. For this site that is already
 * the rule: the CSS version renders first and the enhancement layers on top.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", callback);
      return () => mq.removeEventListener("change", callback);
    },
    [query],
  );

  const getSnapshot = useCallback(
    () => window.matchMedia(query).matches,
    [query],
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
