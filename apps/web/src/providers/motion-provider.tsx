"use client";

import { LazyMotion, domMax } from "motion/react";

/**
 * Lazy-loads Framer Motion's feature bundle ONCE for the whole app.
 *
 * Components import `m as motion` from "motion/react" instead of the full
 * `motion` object; the heavy animation features are provided here via
 * <LazyMotion> instead of being bundled with every component. This shrinks the
 * client bundle with ZERO behavioural change — `m` renders identically to
 * `motion` once the features are loaded.
 *
 * `domMax` is passed as a STATIC value (not a dynamic import). The async form
 * (`features={() => import(...)}`) shaved ~50% off TBT, but it puts the whole
 * app's framer animations behind a separate chunk: if that chunk fails to load
 * (or a stale dev/HMR reference), LazyMotion never receives features and every
 * `m` component is stuck at its initial state — scroll reveals never fire, items
 * stay dimmed/overlapping. Animation correctness outranks the TBT win, so the
 * bundle stays static and always available.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <LazyMotion features={domMax}>{children}</LazyMotion>;
}
