"use client";

import React from "react";

import { usePauseOffscreen } from "@/components/landing/_shared/use-pause-offscreen";

/**
 * Stops looping CSS animations inside `children` once the group scrolls out.
 *
 * One observer for a whole group, rather than one per animated element. The
 * `.anim-paused` class it toggles applies to the element AND its descendants
 * (see globals.css), so a single wrapper covers every letter of a word.
 */
export function PauseOffscreen({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { ref } = usePauseOffscreen<HTMLDivElement>();
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
