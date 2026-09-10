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
  /**
   * O desenho do assunto da página, sangrando pela borda (à direita no
   * alinhamento padrão, atrás do título no centrado). Ver
   * `components/institucional/assinaturas-hero.tsx`: é ele que impede que as
   * quatro sub-páginas abram com o mesmo cartão. Sem ele, cai na marca, que é
   * o que a raiz usa.
   */
  assinatura?: React.ReactNode;
  /**
   * `"centro"` reorganiza o herói inteiro: a copia centrada, mais estreita, e
   * a assinatura atrás dela em vez de ao lado. É composição, não alinhamento de
   * texto, e existe porque uma página que é uma declaração (o manifesto) não se
   * lê como uma que é um índice.
   */
  alinhamento?: "esquerda" | "centro";
  /** `"curta"` para página utilitária, que o leitor abre para achar algo. */
  altura?: "cheia" | "curta";
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
 * - the **signature**, oversized and bled off the edge, as texture. It used to
 *   be the ProOps mark on all four pages, which solved the blank corner and
 *   created a worse problem: four pages opening with the same picture read as
 *   one template filled in four times. Now each page passes a drawing of its
 *   own subject, and the mark is only the fallback;
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
  assinatura,
  alinhamento = "esquerda",
  altura = "cheia",
  children,
  className,
}: PaginaHeroProps) {
  const centrado = alinhamento === "centro";
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
        "relative isolate flex flex-col overflow-hidden bg-neutral-950 px-6 pb-16 pt-36 text-white md:px-10 md:pb-20 md:pt-44",
        altura === "curta" ? "min-h-[66svh]" : "min-h-[82svh]",
        centrado ? "justify-center text-center" : "justify-end",
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

      {/* Sangrando pela borda e cortada pela seção. Desenho que cabe inteiro
          dentro do quadro lê como marca d'água; um que corre para fora dele lê
          como a página tendo sido recortada de algo maior. */}
      <motion.div
        aria-hidden="true"
        style={animated ? { y: marcaY, scale: marcaEscala } : undefined}
        className={cn(
          "pointer-events-none absolute hidden md:block",
          centrado
            ? // Atrás da copia, e por isso mais apagada: aqui ela divide o
              // espaço com o texto em vez de ocupar a metade vazia.
              // O `pt` afasta o selo da navbar: centrado na seção inteira, a
              // marca de cima dele caía atrás do menu.
              "inset-0 grid place-items-center pt-16 text-white/[0.07] md:pt-24"
            : "-right-[8%] top-[8%] w-[44%] text-white/[0.13] lg:-right-[3%] lg:w-[35%]",
        )}
      >
        {centrado ? (
          // Caixa quadrada e limitada por `vw`: sem ela o desenho herdaria a
          // altura da seção inteira, que num monitor largo é um selo do tamanho
          // da tela por cima do título.
          <div className="aspect-square w-[min(78vw,34rem)]">
            {assinatura ?? <Marca className="w-full" />}
          </div>
        ) : (
          (assinatura ?? <Marca className="w-full text-white/[0.045]" />)
        )}
      </motion.div>

      <motion.div
        style={animated ? { y: copiaY, opacity: copiaOpacidade } : undefined}
        className={cn(
          "relative z-10 mx-auto w-full",
          centrado ? "max-w-4xl" : "max-w-6xl",
        )}
      >
        <p
          className={cn(
            "hero-enter mb-8 inline-flex items-center gap-2.5 [font-family:var(--font-geist-mono)] text-[11px] font-medium uppercase tracking-[0.28em] text-white/50 md:text-xs",
            centrado && "flex-row-reverse",
          )}
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
            className={cn(
              "hero-enter mt-8 max-w-2xl text-base leading-relaxed text-white/60 md:text-lg",
              centrado && "mx-auto",
            )}
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
            className={cn(
              "hero-enter mt-12 flex flex-wrap gap-px border-t border-white/10 bg-white/10 md:mt-14",
              centrado && "mx-auto max-w-2xl text-left",
            )}
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
                className={cn(
                  "min-w-[9rem] flex-1 bg-neutral-950 py-5 md:min-w-[11rem]",
                  centrado ? "px-6" : "pr-6",
                )}
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
