"use client";

import { useEffect } from "react";
import { animate, useMotionValue, useTransform, type MotionValue } from "motion/react";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

export function useCountUp(target: number, opts?: { duration?: number }): MotionValue<number> {
  const raw = useMotionValue(0);
  const rounded = useTransform(raw, (v) => Math.round(v));
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) {
      raw.set(target);
      return;
    }
    const controls = animate(raw, target, {
      duration: opts?.duration ?? 1.1,
      ease: [0.2, 0.65, 0.3, 0.9],
    });
    return () => controls.stop();
  }, [target, reduced, raw, opts?.duration]);

  return rounded;
}
