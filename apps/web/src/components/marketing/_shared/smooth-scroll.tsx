"use client";

import React from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import Lenis from "lenis";

import { setLandingLenis } from "@/lib/landing/smooth-scroll";

/**
 * Inertial scrolling for a marketing surface, wired to ScrollTrigger.
 *
 * Renders nothing. Mount it once per page that wants the weighted scroll.
 *
 * Deliberately NOT extracted from `app/_components/landing-page-client.tsx`,
 * which does the same wiring for the ERP landing. That file is the most
 * performance-sensitive page in the product, with an LCP that took real work
 * to earn, and refactoring it to share this would put that at risk for the
 * benefit of removing a duplication that has exactly two instances. If a third
 * surface ever needs it, extract then, with the landing's E2E scroll specs as
 * the safety net.
 *
 * Three things here are load-bearing:
 *
 * 1. Everything is deferred to `requestIdleCallback`. Lenis and
 *    `ScrollTrigger.refresh()` matter only once the visitor starts scrolling,
 *    so keeping them off the first paint costs nothing visually and keeps the
 *    hero's LCP clear of this work.
 * 2. Lenis is never created under `prefers-reduced-motion: reduce`. Smooth
 *    scrolling IS motion, and the native fallback in `scrollToOffset` covers
 *    programmatic scrolling when the instance is absent.
 * 3. Crossing the `md` breakpoint at runtime swaps pinned layouts, leaving
 *    Lenis and every ScrollTrigger holding stale heights. Recalculating on the
 *    crossing is free on the normal path, since it only fires at 768px.
 */
export function SmoothScroll() {
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    let lenis: Lenis | null = null;
    let raf: ((time: number) => void) | null = null;
    let refreshTimeoutId: number | undefined;
    let cancelled = false;
    let mq: MediaQueryList | undefined;
    let onBreakpointCross: (() => void) | undefined;

    const init = () => {
      if (cancelled) return;

      gsap.registerPlugin(ScrollTrigger);

      mq = window.matchMedia("(min-width: 768px)");
      onBreakpointCross = () => {
        requestAnimationFrame(() => {
          lenis?.resize();
          ScrollTrigger.refresh();
        });
      };
      mq.addEventListener("change", onBreakpointCross);
      refreshTimeoutId = window.setTimeout(() => {
        ScrollTrigger.refresh();
      }, 0);

      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        lenis = new Lenis();
        setLandingLenis(lenis);
        lenis.on("scroll", ScrollTrigger.update);
        raf = (time: number) => lenis?.raf(time * 1000);
        gsap.ticker.add(raf);
        gsap.ticker.lagSmoothing(0);
      }
    };

    const hasRic = typeof window.requestIdleCallback === "function";
    const idleId = hasRic
      ? window.requestIdleCallback(init, { timeout: 2000 })
      : window.setTimeout(init, 1);

    return () => {
      cancelled = true;
      if (hasRic) {
        window.cancelIdleCallback?.(idleId as number);
      } else {
        window.clearTimeout(idleId as number);
      }
      if (refreshTimeoutId !== undefined) window.clearTimeout(refreshTimeoutId);
      if (mq && onBreakpointCross) {
        mq.removeEventListener("change", onBreakpointCross);
      }
      if (raf) gsap.ticker.remove(raf);
      setLandingLenis(null);
      lenis?.destroy();
    };
  }, []);

  return null;
}
