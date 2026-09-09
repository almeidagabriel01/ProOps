"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/** Desktop only, and only for visitors who did not ask for less movement. */
export const SCENE_DESKTOP =
  "(min-width: 768px) and (prefers-reduced-motion: no-preference)";
/** Any width, still respecting the motion preference. */
export const SCENE_ANY_WIDTH = "(prefers-reduced-motion: no-preference)";

interface ScrollSceneOptions {
  /** Media query the scene is built under. Defaults to desktop only. */
  query?: string;
  /** Re-run when these change, same contract as useGSAP's dependencies. */
  dependencies?: unknown[];
}

/**
 * The house pattern for a scroll-driven section, in one place.
 *
 * Every animated section on the ERP landing repeats the same five lines:
 * register ScrollTrigger, open a `gsap.matchMedia()`, add a query that carries
 * `prefers-reduced-motion: no-preference`, build the timeline, revert on
 * teardown. Copied thirteen times, it drifts: a section that forgets the
 * motion-preference half of the query animates for someone who asked it not
 * to, and nothing fails.
 *
 * `useGSAP` with a `scope` already reverts on unmount; the explicit
 * `mm.revert()` covers the other case, crossing the media query at runtime
 * (resizing past 768px, or toggling the device toolbar), where the old
 * timeline would otherwise keep its transforms.
 *
 * Under `reduce`, no timeline is ever created and the DOM keeps whatever the
 * server rendered. That is why sections must be authored in their FINAL state
 * and animated with `fromTo`, never with `to` from an invisible start.
 */
export function useScrollScene(
  scope: React.RefObject<HTMLElement | null>,
  build: (context: {
    timeline: typeof gsap;
    scrollTrigger: typeof ScrollTrigger;
  }) => void,
  { query = SCENE_DESKTOP, dependencies = [] }: ScrollSceneOptions = {},
) {
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(query, () => {
        build({ timeline: gsap, scrollTrigger: ScrollTrigger });
      });
      return () => {
        mm.revert();
      };
    },
    { scope, dependencies },
  );
}
