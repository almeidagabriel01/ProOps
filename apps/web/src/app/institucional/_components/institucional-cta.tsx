"use client";

import React, { useRef } from "react";
import { m as motion, useTransform } from "motion/react";

import { LandingButton } from "@/components/landing/_shared/landing-button";
import { EMPRESA_LINKS } from "@/components/institucional/nav-links";
import { Realce } from "@/components/institucional/secao";
import { CurtainLink } from "@/components/marketing/_shared/curtain-transition";
import { Magnetic } from "@/components/marketing/_shared/magnetic";
import { useScrollProgress } from "@/components/marketing/_shared/use-scroll-progress";
import { SITE_URLS } from "@/lib/site/surfaces";
import { cn } from "@/lib/utils";

const PALAVRAS = ["Escolha", "por", "onde", "começar."];

/**
 * The ending: the invitation, then the way into the rest of the site.
 *
 * The chrome finish that used to bookend the hero is gone with it. What closes
 * the page now is the same thing that opened it, type at scale, and the last
 * line rises word by word as the reader arrives, which is the hero's entrance
 * played once more at the other end.
 *
 * The index of the five sub-pages is here and not only in the footer on purpose.
 * A reader who scrolled the whole root experience has just been given the short
 * version of everything; the moment they finish is the moment they are most
 * likely to want the long version of ONE of them. A footer nav is a fallback for
 * someone looking for a link, not an offer.
 *
 * The numbers used to live here and moved to their own scene: sharing a screen
 * with the two closing buttons meant the last thing anyone saw was a wall of
 * zeros next to a call to action.
 */
export function InstitucionalCta() {
  const secao = useRef<HTMLElement>(null);
  const { progress, animated } = useScrollProgress(secao, {
    start: "top 85%",
    end: "bottom bottom",
    fallback: 1,
  });

  return (
    <section
      ref={secao}
      aria-label="Por onde começar"
      className="relative isolate overflow-hidden border-t border-white/10 bg-neutral-950 px-6 py-28 text-white md:px-10 md:py-40"
    >
      <div aria-hidden="true" className="campo-reativo pointer-events-none" />

      <div className="relative z-10 mx-auto max-w-6xl">
        <h2 className="mx-auto max-w-4xl text-center [font-family:var(--font-bricolage)] text-[clamp(2rem,6vw,4.5rem)] font-extrabold leading-[1.02] tracking-[-0.03em]">
          {/* Word by word, each clipped by its own wrapper: the same rise the
              hero opens with, closing the page. `inline-block` on the wrapper
              keeps the words on one baseline and lets the line wrap normally. */}
          {PALAVRAS.map((palavra, index) => (
            <Palavra
              key={palavra}
              palavra={palavra}
              indice={index}
              total={PALAVRAS.length}
              progresso={progress}
              animado={animated}
            />
          ))}
        </h2>

        <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Magnetic>
            <LandingButton
              href={SITE_URLS.erp}
              external
              variant="inverted"
              size="lg"
            >
              Conhecer o ERP
            </LandingButton>
          </Magnetic>
          <LandingButton href={SITE_URLS.app} external variant="link" size="lg">
            Conhecer o aplicativo
          </LandingButton>
        </div>

        <div className="mt-24 border-t border-white/10 pt-14 md:mt-32">
          <p className="mb-10 text-center [font-family:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.26em] text-white/40">
            Ou conheça a empresa
          </p>

          {/*
            Five items in a three-column grid leave a hole, and the hole is not
            empty: the grid's own background shows through the one-pixel gaps and
            it reads as a sixth card that failed to load. The last item spans the
            remainder instead, at both breakpoints, which also gives the contact
            card the width its longer line wants.
          */}
          <ul className="grid gap-px bg-white/10 md:grid-cols-2 lg:grid-cols-3">
            {EMPRESA_LINKS.map((link, index) => (
              <li
                key={link.href}
                className={cn(
                  "bg-neutral-950",
                  index === EMPRESA_LINKS.length - 1 && "md:col-span-2",
                )}
              >
                <CurtainLink
                  href={link.href}
                  className="group flex h-full flex-col justify-between gap-8 p-7 transition-colors duration-300 hover:bg-white/[0.04] md:p-9"
                >
                  <span
                    aria-hidden="true"
                    className="[font-family:var(--font-geist-mono)] text-[11px] tabular-nums text-white/30"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <span className="flex items-center gap-2 [font-family:var(--font-bricolage)] text-2xl font-semibold tracking-tight text-white">
                      {link.rotulo}
                      <span
                        aria-hidden="true"
                        className="inline-block text-white/35 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-white"
                      >
                        &rarr;
                      </span>
                    </span>
                    <span className="mt-3 block text-sm leading-relaxed text-white/50">
                      {link.resumo}
                    </span>
                  </span>
                </CurtainLink>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="relative z-10 mx-auto mt-20 max-w-2xl text-center text-base leading-relaxed text-white/45 md:text-lg">
        Se ainda não é hora de nenhum dos dois, a gente também{" "}
        <Realce className="text-white/70">responde e-mail</Realce>.
      </p>
    </section>
  );
}

function Palavra({
  palavra,
  indice,
  total,
  progresso,
  animado,
}: {
  palavra: string;
  indice: number;
  total: number;
  progresso: ReturnType<typeof useScrollProgress>["progress"];
  animado: boolean;
}) {
  const fatia = 0.45 / total;
  const de = 0.1 + indice * fatia;
  const ate = de + fatia * 2.4;
  const y = useTransform(progresso, [de, ate], ["110%", "0%"]);

  return (
    <span className="inline-block overflow-hidden pb-[0.12em] align-bottom">
      <motion.span
        style={animado ? { y } : undefined}
        className="inline-block"
      >
        {palavra}
        {indice < total - 1 ? " " : ""}
      </motion.span>
    </span>
  );
}
