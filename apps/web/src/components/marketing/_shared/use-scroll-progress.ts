"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { useMotionValue, type MotionValue } from "motion/react";

import { useReducedMotion } from "@/components/landing/_shared/use-reduced-motion";

/**
 * A section's own scroll progress, 0 to 1, as a MotionValue.
 *
 * This is the pipe that `landing-security.tsx` arrived at the hard way, lifted
 * out so every scene can reuse it. Two decisions are load-bearing, and both are
 * about a bug that does not look like a bug:
 *
 * 1. **The progress comes from ScrollTrigger, never from framer's `useScroll`.**
 *    The marketing pages run Lenis, which is wired to `ScrollTrigger.update`.
 *    `useScroll` reads the scroll position independently, so its progress drifts
 *    AHEAD of the rendered position and reveals fire before the content they
 *    belong to reaches the viewport. Sourcing from the same ScrollTrigger the
 *    rest of the page uses keeps everything on one clock.
 *
 * 2. **The ScrollTrigger is created late, by IntersectionObserver.**
 *    `ScrollTrigger.create` does synchronous layout measurement. Creating one
 *    per section at load cost ~1.7s of TBT on the ERP home, measured. At
 *    `rootMargin: "150% 0px"` the trigger exists about a viewport and a half
 *    before the reader arrives, which is early enough to be invisible and late
 *    enough to be off the load critical path.
 *
 * Under `prefers-reduced-motion` no trigger is created and the value stays at
 * `fallback`. Pass `fallback: 1` for a scene whose final state is "fully
 * revealed", which is what lets a single component render correctly for both
 * audiences without a second implementation.
 */
export interface ScrollProgressOptions {
  /** ScrollTrigger `start`. Defaults to the section entering the top. */
  start?: string;
  /** ScrollTrigger `end`. Defaults to the section's bottom leaving the bottom. */
  end?: string;
  /** Value held when motion is reduced. `1` means "already fully revealed". */
  fallback?: number;
  /** How far out the trigger is created. Rarely worth changing. */
  rootMargin?: string;
}

export function useScrollProgress(
  target: React.RefObject<HTMLElement | null>,
  {
    start = "top top",
    end = "bottom bottom",
    fallback = 1,
    rootMargin = "150% 0px",
  }: ScrollProgressOptions = {},
): { progress: MotionValue<number>; animated: boolean } {
  const reduce = useReducedMotion();
  const progress = useMotionValue(reduce ? fallback : 0);

  useEffect(() => {
    if (reduce) {
      progress.set(fallback);
      return;
    }
    const el = target.current;
    if (!el) return;

    let st: ScrollTrigger | undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || st) return;
        gsap.registerPlugin(ScrollTrigger);
        st = ScrollTrigger.create({
          trigger: el,
          start,
          end,
          onUpdate: (self) => progress.set(self.progress),
          onRefresh: (self) => progress.set(self.progress),
        });
        io.disconnect();
      },
      { rootMargin },
    );
    io.observe(el);

    return () => {
      io.disconnect();
      st?.kill();
    };
    // The trigger geometry is in the dependency list rather than read through a
    // ref: every caller passes literals, so this never re-runs in practice, and
    // if one ever does compute them, rebuilding the trigger is the right answer.
  }, [reduce, fallback, progress, target, start, end, rootMargin]);

  return { progress, animated: !reduce };
}
