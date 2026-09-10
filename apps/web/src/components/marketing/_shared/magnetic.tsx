"use client";

import React, { useRef } from "react";
import gsap from "gsap";

import { useReducedMotion } from "@/components/landing/_shared/use-reduced-motion";
import { cn } from "@/lib/utils";

interface MagneticProps {
  children: React.ReactNode;
  /** How far the element is allowed to travel, in px. */
  forca?: number;
  /** Radius around the element that starts attracting, as a multiple of its size. */
  alcance?: number;
  className?: string;
}

/**
 * Pulls its child toward the cursor while the cursor is near it.
 *
 * Deliberately NOT built on `pointerenter`: the effect only reads as magnetism
 * if the attraction starts before the cursor arrives, so the listener is on the
 * window and the distance is measured against the element's own box.
 *
 * `quickTo` and not `gsap.to`: a tween per pointer event allocates a timeline
 * sixty times a second and they fight each other for the same property.
 * `quickTo` reuses one, which is also why the cleanup has to reset x/y by hand
 * on the way out.
 *
 * Touch devices and `prefers-reduced-motion` get the child untouched, with no
 * listener attached at all.
 */
export function Magnetic({
  children,
  forca = 14,
  alcance = 1.8,
  className,
}: MagneticProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();

  React.useEffect(() => {
    if (reduce) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const el = ref.current;
    if (!el) return;

    const paraX = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
    const paraY = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });

    const onMove = (event: PointerEvent) => {
      const box = el.getBoundingClientRect();
      const cx = box.left + box.width / 2;
      const cy = box.top + box.height / 2;
      const dx = event.clientX - cx;
      const dy = event.clientY - cy;
      const raio = (Math.max(box.width, box.height) / 2) * alcance;
      const distancia = Math.hypot(dx, dy);

      if (distancia > raio) {
        paraX(0);
        paraY(0);
        return;
      }
      const peso = 1 - distancia / raio;
      paraX((dx / raio) * forca * peso * 2);
      paraY((dy / raio) * forca * peso * 2);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      gsap.set(el, { x: 0, y: 0 });
    };
  }, [reduce, forca, alcance]);

  return (
    <span ref={ref} className={cn("inline-block will-change-transform", className)}>
      {children}
    </span>
  );
}
