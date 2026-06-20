"use client";

import { LazyMotion } from "motion/react";

// Load the domMax feature bundle via dynamic import so it is fetched/parsed AFTER
// hydration instead of during it — halving TBT on the public pages (the static
// `features={domMax}` form runs ~34kb of features on the main thread while the
// page hydrates). The whole app's `m` components stay at their static initial
// state until the features resolve a tick later, then animate normally.
//
// Verified in a CLEAN production build: scroll-driven animations (e.g. the home
// Security section) reach their final state and there is no ChunkLoadError. A
// ChunkLoadError seen earlier was a stale Turbopack DEV/HMR chunk reference from
// rapidly editing this file — not a production failure. If the dev server ever
// shows it, clear it with `rm -rf apps/web/.next` and restart `npm run dev`;
// motion-features.ts never changes in normal development, so the chunk is stable.
const loadMotionFeatures = () =>
  import("./motion-features").then((res) => res.default);

/**
 * Lazy-loads Framer Motion's domMax feature bundle ONCE for the whole app, after
 * hydration. Components import `m as motion`; domMax is the superset covering the
 * layout animations (`layout` / `layoutId`) the app uses, so behaviour is
 * unchanged — only load timing differs.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <LazyMotion features={loadMotionFeatures}>{children}</LazyMotion>;
}
