"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface MonoFieldProps {
  className?: string;
}

/**
 * Atmospheric background for the full-bleed near-black bands (Como Funciona,
 * Segurança, CTA). Slow-drifting monochrome radial glows + film grain create
 * depth without any accent color. Decorative only — `aria-hidden`, and the
 * drift animation is killed under prefers-reduced-motion via globals.css.
 */
export function MonoField({ className }: MonoFieldProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
    >
      <div className="animate-mono-drift absolute -left-[15%] -top-[20%] h-[55vh] w-[55vh] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.12),transparent_62%)] blur-3xl" />
      <div
        className="animate-mono-drift absolute -right-[12%] bottom-[-18%] h-[50vh] w-[50vh] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.08),transparent_62%)] blur-3xl"
        style={{ animationDelay: "-10s" }}
      />
      <div className="grain-overlay" />
    </div>
  );
}
