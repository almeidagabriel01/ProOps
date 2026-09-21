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
 * The blur comes from Tailwind's `backdrop-blur` utility, not from the
 * stylesheet: a raw `backdrop-filter` written in globals.css is stripped
 * before it reaches the browser, silently, while every other declaration in
 * the same rule survives.
 *
 * It sets `position: relative`, and because globals.css is unlayered that
 * declaration BEATS Tailwind's `absolute` and `fixed` utilities on equal
 * specificity. To place a pane, wrap it in a positioned element rather than
 * passing the positioning class here, or it silently stays in normal flow.
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
      className={cn(
        "liquid-glass backdrop-blur-xl backdrop-saturate-[1.8]",
        className,
      )}
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
