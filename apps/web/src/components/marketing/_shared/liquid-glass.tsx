import React from "react";

import { cn } from "@/lib/utils";

interface LiquidGlassProps {
  children: React.ReactNode;
  as?: "div" | "article" | "aside" | "figure";
  /** Seconds for one pass of the travelling highlight. */
  durationSeconds?: number;
  /** Delay before the first pass. Stagger it across cards so they do not pulse together. */
  delaySeconds?: number;
  className?: string;
}

/**
 * A pane of the same glass the app is built from.
 *
 * A Server Component: the whole effect is `.liquid-glass` in globals.css, so
 * this costs nothing on the client. Pausing the highlight off-screen is the
 * caller's job, via `PauseOffscreen` around the group.
 *
 * Give it a `rounded-*` class at the call site. The inner highlight inherits
 * the radius, and a square-cornered pane of glass looks like a mistake.
 */
export function LiquidGlass({
  children,
  as = "div",
  durationSeconds,
  delaySeconds,
  className,
}: LiquidGlassProps) {
  const Tag = as as React.ElementType;

  return (
    <Tag
      className={cn("liquid-glass", className)}
      style={
        {
          ...(durationSeconds ? { "--glass-dur": `${durationSeconds}s` } : {}),
          ...(delaySeconds !== undefined
            ? { "--glass-delay": `${delaySeconds}s` }
            : {}),
        } as React.CSSProperties
      }
    >
      {children}
    </Tag>
  );
}
