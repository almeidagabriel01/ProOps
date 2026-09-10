"use client";

import React from "react";

import { cn } from "@/lib/utils";

interface PaginaHeroProps {
  sobrancelha: string;
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  /** Rendered under the description: a CTA row, a count, a lead-in. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * The opening of a company sub-page.
 *
 * Shorter than the root experience's hero on purpose: the reader arrived here on
 * a specific errand, so the page has to say what it is and let them start
 * reading. A second full-viewport wordmark on every page would read as five
 * copies of the same site rather than five pages of one.
 *
 * The entrance is the `hero-enter` / `hero-rise-line` CSS pair, not a motion
 * component, for the reason written into globals.css: an `initial={{opacity:0}}`
 * holds the LCP text invisible until the bundle hydrates. That matters more
 * here than on the root, because these pages are also entered directly from
 * search rather than only through the curtain.
 *
 * The title is split into lines by the CALLER, as an array, rather than by
 * SplitText. A per-line rise needs the line boxes to exist before the animation
 * is authored, and SplitText computes them from the rendered layout, which on a
 * page whose font is still loading gives a different break than the one the
 * reader ends up seeing. Explicit lines are also editable copy.
 */
export function PaginaHero({
  sobrancelha,
  titulo,
  descricao,
  children,
  className,
}: PaginaHeroProps) {
  return (
    <section
      aria-label={sobrancelha}
      className={cn(
        "relative isolate flex min-h-[76svh] flex-col justify-end overflow-hidden bg-neutral-950 px-6 pb-16 pt-36 text-white md:px-10 md:pb-24 md:pt-44",
        className,
      )}
    >
      <div aria-hidden="true" className="campo-reativo" />
      <div
        aria-hidden="true"
        className="grade-pontos pointer-events-none absolute inset-0 opacity-50"
      />

      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <p
          className="hero-enter mb-8 inline-flex items-center gap-2.5 [font-family:var(--font-geist-mono)] text-[11px] font-medium uppercase tracking-[0.28em] text-white/50 md:text-xs"
          style={
            {
              "--hero-y": "-8px",
              "--hero-dur": "0.45s",
            } as React.CSSProperties
          }
        >
          <span aria-hidden="true" className="h-px w-7 bg-white/35" />
          {sobrancelha}
        </p>

        <h1 className="[font-family:var(--font-bricolage)] text-[clamp(2.6rem,8vw,6rem)] font-extrabold leading-[0.95] tracking-[-0.04em]">
          {titulo}
        </h1>

        {descricao && (
          <p
            className="hero-enter mt-8 max-w-2xl text-base leading-relaxed text-white/60 md:text-lg"
            style={
              {
                "--hero-y": "16px",
                "--hero-delay": "0.42s",
              } as React.CSSProperties
            }
          >
            {descricao}
          </p>
        )}

        {children && (
          <div
            className="hero-enter mt-10"
            style={
              {
                "--hero-y": "12px",
                "--hero-delay": "0.54s",
                "--hero-dur": "0.5s",
              } as React.CSSProperties
            }
          >
            {children}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * One line of a `PaginaHero` title, rising from a clipped baseline.
 *
 * The clip is `overflow-hidden` on the wrapper, and the padding under it is what
 * keeps descenders (the "p" in "projeto", the "g" in "gestão") from being
 * decapitated by that clip; the negative margin hands the space back to the line
 * box so the block does not grow taller than the type.
 */
export function LinhaHero({
  children,
  atraso = 0,
}: {
  children: React.ReactNode;
  atraso?: number;
}) {
  return (
    <span className="-mb-[0.16em] block overflow-hidden pb-[0.18em]">
      <span
        className="hero-rise-line"
        style={
          {
            "--hero-delay": `${0.08 + atraso}s`,
            "--hero-dur": "0.95s",
          } as React.CSSProperties
        }
      >
        {children}
      </span>
    </span>
  );
}
