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
 * `domMax` is used (not the lighter `domAnimation`) because the app relies on
 * layout animations (`layout` / `layoutId`); domMax is the superset that also
 * covers them and gestures, so every existing animation keeps working exactly
 * as before. Any component still importing the full `motion` keeps working too
 * (full motion is self-contained) — it just doesn't benefit from the lazy split.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <LazyMotion features={domMax}>{children}</LazyMotion>;
}
