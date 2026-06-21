"use client";

import { LazyMotion, domMax } from "motion/react";

/**
 * Lazy-loads Framer Motion's feature bundle ONCE for the whole app.
 *
 * Components import `m as motion` from "motion/react" instead of the full
 * `motion` object; the heavy animation features are provided here via
 * <LazyMotion> instead of being bundled with every component.
 *
 * `domMax` is passed STATICALLY (not via dynamic import). The async form
 * (`features={() => import("./motion-features")}`) cut ~50% off TBT, but under
 * Turbopack dev it intermittently fails to load the features chunk
 * (ChunkLoadError), and when that happens LazyMotion never receives features:
 * every `m` component is frozen at its initial state, so the home Security
 * scrollytelling stays dimmed (items at opacity 0.15, "TUDO PROTEGIDO" and
 * "ROLE PARA BLINDAR" both showing) and the Niche index numbers vanish. It works
 * in a clean production build, but breaking the animations in the dev workflow
 * is not an acceptable trade for the TBT score, so features stay static and
 * always-present. domMax is the superset covering the app's layout animations.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <LazyMotion features={domMax}>{children}</LazyMotion>;
}
