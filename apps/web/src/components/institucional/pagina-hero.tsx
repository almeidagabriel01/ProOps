"use client";

import React, { useRef } from "react";
import dynamic from "next/dynamic";
import { m as motion, useTransform } from "motion/react";

import { Marca } from "@/components/institucional/marca";
import { useScrollProgress } from "@/components/marketing/_shared/use-scroll-progress";
import { DesktopOnlyWebGl } from "@/components/marketing/_shared/webgl/desktop-only";
import { cn } from "@/lib/utils";

const CampoDePontos = dynamic(
  () => import("@/components/marketing/_shared/webgl/campo-de-pontos"),
  { ssr: false },
);

export interface DadoDoHero {
  /** Two or three characters. The number is the point. */
  valor: string;
  rotulo: string;
}

interface PaginaHeroProps {
  sobrancelha: string;
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  /**
   * A short strip of facts under the copy: three at most, two words each.
   * It is what turns a title card into a page that has already told you
   * something before you scrolled.
   */
  dados?: DadoDoHero[];
  /** Rendered under everything: a CTA row, a lead-in. */
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
 * "Shorter" is not "plainer", which is what the first version got wrong: an
 * eyebrow, a title and a paragraph is a title card, and four of them in a row
 * make a site feel like a template. Four things carry it now, and each is doing
 * something the others are not:
 *
 * - the **mark, oversized and bled off the right edge**, as texture. It is the
 *   only ornament, it is the brand, and cropping it is what keeps it from
 *   reading as a watermark stamped in a corner;
 * - the **dot lattice** that answers the pointer, the same one the root hero
 *   uses, so the two surfaces are visibly one site;
 * - a **parallax** on the copy and a counter-parallax on the mark, so leaving
 *   the hero is a movement rather than a cut;
 * - an optional **strip of facts**, which is the part that makes the screen
 *   informative instead of decorative.
 *
 * The entrance is still the `hero-enter` / `hero-rise-line` CSS pair, not a
 * motion component, for the reason written into globals.css: an
 * `initial={{opacity:0}}` holds the LCP text invisible until the bundle
 * hydrates. That matters more here than on the root, because these pages are
 * also entered directly from search rather than only through the curtain.
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
  dados,
  children,
  className,
}: PaginaHeroProps) {
  const secao = useRef<HTMLElement>(null);
  // `start: "top top"` and not the default: the hero is the first thing on the
  // page, so its progress has to be measured from the moment it starts LEAVING,
  // not from the moment it enters, which already happened.
  const { progress, animated } = useScrollProgress(secao, {
    start: "top top",
    end: "bottom top",
    fallback: 0,
  });

  const copiaY = useTransform(progress, [0, 1], ["0%", "-18%"]);
  const copiaOpacidade = useTransform(progress, [0, 0.75], [1, 0]);
  const marcaY = useTransform(progress, [0, 1], ["0%", "12%"]);
  const marcaEscala = useTransform(progress, [0, 1], [1, 1.14]);

  return (
    <section
      ref={secao}
      aria-label={sobrancelha}
      className={cn(
        "relative isolate flex min-h-[82svh] flex-col justify-end overflow-hidden bg-neutral-950 px-6 pb-16 pt-36 text-white md:px-10 md:pb-20 md:pt-44",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="grade-pontos pointer-events-none absolute inset-0 opacity-70"
      />
      <div aria-hidden="true" className="campo-reativo opacity-60" />
      <DesktopOnlyWebGl>
        <CampoDePontos
          intensidade={0.26}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
      </DesktopOnlyWebGl>

      {/* Bled off the right edge and clipped by the section. A mark that fits
          inside the frame reads as a watermark; one that runs off it reads as
          the page being cut out of something bigger. */}
      <motion.div
        aria-hidden="true"
        style={animated ? { y: marcaY, scale: marcaEscala } : undefined}
        className="pointer-events-none absolute -right-[14%] top-[6%] hidden w-[46%] md:block lg:-right-[8%] lg:w-[38%]"
      >
        <Marca className="w-full text-white/[0.045]" />
      </motion.div>

      <motion.div
        style={animated ? { y: copiaY, opacity: copiaOpacidade } : undefined}
        className="relative z-10 mx-auto w-full max-w-6xl"
      >
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

        {dados && dados.length > 0 && (
          <dl
            className="hero-enter mt-12 flex flex-wrap gap-px border-t border-white/10 bg-white/10 md:mt-14"
            style={
              {
                "--hero-y": "14px",
                "--hero-delay": "0.56s",
              } as React.CSSProperties
            }
          >
            {dados.map((dado) => (
              <div
                key={dado.rotulo}
                className="min-w-[9rem] flex-1 bg-neutral-950 py-5 pr-6 md:min-w-[11rem]"
              >
                <dt className="sr-only">{dado.rotulo}</dt>
                <dd className="[font-family:var(--font-bricolage)] text-3xl font-extrabold leading-none tracking-[-0.04em] text-white md:text-4xl">
                  {dado.valor}
                </dd>
                <p
                  aria-hidden="true"
                  className="mt-3 max-w-[14ch] [font-family:var(--font-geist-mono)] text-[10px] uppercase leading-relaxed tracking-[0.16em] text-white/40"
                >
                  {dado.rotulo}
                </p>
              </div>
            ))}
          </dl>
        )}

        {children && (
          <div
            className="hero-enter mt-10"
            style={
              {
                "--hero-y": "12px",
                "--hero-delay": "0.68s",
                "--hero-dur": "0.5s",
              } as React.CSSProperties
            }
          >
            {children}
          </div>
        )}
      </motion.div>
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
