import React from "react";

import { cn } from "@/lib/utils";

interface ChromeTextProps {
  children: React.ReactNode;
  /** Element to render. Use the real heading level; this is display type, not a heading by itself. */
  as?: "span" | "h1" | "h2" | "p";
  /** Ground the type sits on. Picks the ramp that keeps every glyph readable. */
  tone?: "onDark" | "onLight";
  /** Seconds for one sweep of the specular highlight. Slower reads as heavier metal. */
  durationSeconds?: number;
  /** Delay before the first sweep. Stagger it across letters and the light travels. */
  delaySeconds?: number;
  className?: string;
  style?: React.CSSProperties;
  "aria-hidden"?: boolean | "true" | "false";
}

/**
 * Polished metal type: the signature of the company page.
 *
 * A Server Component with no state and no effect, so it costs nothing on the
 * client. The effect is entirely `.chrome-text` in globals.css.
 *
 * APPLY IT TO THE ELEMENT THAT HOLDS THE TEXT, never to an ancestor.
 * `background-clip: text` clips an element's own background to its own glyphs;
 * a child `<span>` inherits the transparent colour but has no background of its
 * own, so the letters simply vanish. Splitting a word into animated letters
 * means each letter carries its own `ChromeText`. The vertical ramp is
 * identical per letter, so the metal still reads as one continuous surface.
 *
 * Pausing the sweep off-screen is the caller's job: wrap the group in
 * `PauseOffscreen`, which pauses descendants, instead of giving every letter
 * its own observer.
 */
export function ChromeText({
  children,
  as = "span",
  tone = "onDark",
  durationSeconds,
  delaySeconds,
  className,
  style,
  "aria-hidden": ariaHidden,
}: ChromeTextProps) {
  const Tag = as as React.ElementType;

  return (
    <Tag
      aria-hidden={ariaHidden}
      className={cn(
        "chrome-text",
        tone === "onLight" && "chrome-text--on-light",
        className,
      )}
      style={
        {
          ...style,
          ...(durationSeconds ? { "--chrome-dur": `${durationSeconds}s` } : {}),
          ...(delaySeconds !== undefined
            ? { "--chrome-delay": `${delaySeconds}s` }
            : {}),
        } as React.CSSProperties
      }
    >
      {children}
    </Tag>
  );
}
