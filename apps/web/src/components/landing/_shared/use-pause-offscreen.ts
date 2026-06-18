"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Pauses continuous CSS animations while the element is outside the viewport.
 *
 * Attach the returned ref to a section wrapper. When the element leaves the
 * viewport an `anim-paused` class is added (see globals.css), which sets
 * `animation-play-state: paused` on the element and its descendants. This
 * stops infinite CSS keyframe loops (e.g. `.animate-flow`, `.animate-pulse-slow`)
 * from burning CPU/battery while scrolled off-screen.
 *
 * Also exposes `inView` for callers that need to gate non-CSS animation (SVG
 * SMIL `<animateTransform>`, which ignores `animation-play-state`).
 */
export function usePauseOffscreen<T extends HTMLElement = HTMLDivElement>(): {
  ref: React.RefObject<T | null>;
  inView: boolean;
} {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        el.classList.toggle("anim-paused", !entry.isIntersecting);
      },
      { threshold: 0.01 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, inView };
}
