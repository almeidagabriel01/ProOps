"use client";

import { LazyMotion } from "motion/react";

// Load the domMax feature bundle via dynamic import so it is fetched and parsed
// AFTER hydration instead of during it. Passing the bundle as a static value
// (`features={domMax}`) pulls ~34kb of framer features into the critical chunk
// and runs them on the main thread while the page hydrates, inflating TBT. The
// function form keeps `m` components at their static initial state until the
// features resolve a tick later — behaviourally identical at load on these
// pages: the heroes are now CSS-driven (no framer at first paint), and the only
// above-the-fold `m` user is the navbar, whose spring reacts to scroll (which
// hasn't happened yet). Below-the-fold / form / calendar animations are unaffected.
const loadMotionFeatures = () =>
  import("./motion-features").then((res) => res.default);

/**
 * Lazy-loads Framer Motion's feature bundle ONCE for the whole app, AFTER
 * hydration. Components import `m as motion` from "motion/react"; domMax is the
 * superset covering layout animations (`layout` / `layoutId`) and gestures, so
 * every existing animation keeps working exactly as before — only load timing
 * changes.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <LazyMotion features={loadMotionFeatures}>{children}</LazyMotion>;
}
