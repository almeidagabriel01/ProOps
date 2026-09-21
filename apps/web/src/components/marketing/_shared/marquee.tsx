"use client";

import React from "react";

import { PauseOffscreen } from "./pause-offscreen";
import { cn } from "@/lib/utils";

interface MarqueeProps {
  children: React.ReactNode;
  /** Seconds for one full pass. Bigger is slower. */
  duracao?: number;
  /** Right to left by default. */
  invertido?: boolean;
  className?: string;
  /** Applied to each copy of the content. */
  faixaClassName?: string;
}

/**
 * An endless horizontal band.
 *
 * `.animate-marquee-x` translates the track by exactly -50%, so the content has
 * to be rendered TWICE for the loop to be seamless: at -50% the second copy is
 * sitting exactly where the first one started. That contract lived only in a
 * comment next to the keyframe, and the duplication was the caller's job; here
 * it is the component's, which is the whole reason to have one.
 *
 * The duplicate is `aria-hidden`: a screen reader should hear the band once.
 *
 * Wrapped in `PauseOffscreen` because an infinite CSS animation keeps the
 * compositor busy even scrolled far out of view, and the page has several of
 * these. The keyframe is already in the reduced-motion kill list in globals.css,
 * so someone who asked for less movement gets a static strip.
 */
export function Marquee({
  children,
  duracao = 32,
  invertido = false,
  className,
  faixaClassName,
}: MarqueeProps) {
  const copia = (
    <div className={cn("flex shrink-0 items-center", faixaClassName)}>
      {children}
    </div>
  );

  return (
    <PauseOffscreen
      className={cn("relative w-full overflow-hidden", className)}
    >
      <div
        className="animate-marquee-x flex w-max"
        style={{
          animationDuration: `${duracao}s`,
          animationDirection: invertido ? "reverse" : "normal",
        }}
      >
        {copia}
        <div aria-hidden="true" className="contents">
          {copia}
        </div>
      </div>
    </PauseOffscreen>
  );
}
