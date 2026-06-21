"use client";

import React, { useRef } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "./use-reduced-motion";

interface MonoGlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 3D tilt following the pointer */
  tilt?: boolean;
  /** Radial spotlight following the pointer */
  spotlight?: boolean;
  /** Rotating conic light-sweep border on hover (reuses .card-border-beam) */
  beam?: boolean;
  /** Max tilt angle, in degrees */
  maxTilt?: number;
  children: React.ReactNode;
}

/**
 * Signature card of the redesigned landing (mono premium): frosted glass surface,
 * pointer-driven 3D tilt + spotlight, optional conic light-sweep border. All
 * pointer motion is disabled under prefers-reduced-motion, leaving a static,
 * fully legible card. The visible content is wrapped above the overlay layers.
 */
export function MonoGlassCard({
  tilt = true,
  spotlight = true,
  beam = false,
  maxTilt = 5,
  className,
  style,
  children,
  ...props
}: MonoGlassCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const interactive = !reduced;

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--mx", `${(px * 100).toFixed(2)}%`);
    el.style.setProperty("--my", `${(py * 100).toFixed(2)}%`);
    if (tilt) {
      el.style.setProperty("--rx", `${((0.5 - py) * maxTilt * 2).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${((px - 0.5) * maxTilt * 2).toFixed(2)}deg`);
    }
  };

  const handleLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };

  return (
    <div
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      style={{
        transform:
          interactive && tilt
            ? "perspective(1200px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg))"
            : undefined,
        ...style,
      }}
      className={cn(
        "group/card relative overflow-hidden rounded-3xl border border-black/10 bg-white/70 backdrop-blur-xl transition-[transform,border-color,box-shadow] duration-300 ease-out",
        "shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_24px_60px_-36px_rgba(0,0,0,0.45)] hover:border-black/20",
        "dark:border-white/10 dark:bg-white/[0.035] dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_36px_90px_-48px_rgba(0,0,0,0.85)] dark:hover:border-white/20",
        className,
      )}
      {...props}
    >
      {beam && (
        <span
          aria-hidden
          className="card-border-beam opacity-0 transition-opacity duration-500 group-hover/card:opacity-100"
        />
      )}
      {spotlight && interactive && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/card:opacity-100 dark:hidden"
            style={{
              background:
                "radial-gradient(440px circle at var(--mx,50%) var(--my,50%), rgba(0,0,0,0.07), transparent 60%)",
            }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 hidden opacity-0 transition-opacity duration-300 group-hover/card:opacity-100 dark:block"
            style={{
              background:
                "radial-gradient(440px circle at var(--mx,50%) var(--my,50%), rgba(255,255,255,0.10), transparent 60%)",
            }}
          />
        </>
      )}
      <div className="relative z-10 flex h-full flex-col">{children}</div>
    </div>
  );
}
