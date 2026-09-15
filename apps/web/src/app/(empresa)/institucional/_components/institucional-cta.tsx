"use client";

import React, { useRef } from "react";
import { m as motion, useTransform } from "motion/react";

import { LandingButton } from "@/components/landing/_shared/landing-button";
import { Realce } from "@/components/institucional/secao";
import { Magnetic } from "@/components/marketing/_shared/magnetic";
import { useScrollProgress } from "@/components/marketing/_shared/use-scroll-progress";
import { SITE_URLS } from "@/lib/site/surfaces";

const PALAVRAS = ["Escolha", "por", "onde", "começar."];

/**
 * The ending: the invitation, then the way into the rest of the site.
 *
 * The chrome finish that used to bookend the hero is gone with it. What closes
 * the page now is the same thing that opened it, type at scale, and the last
 * line rises word by word as the reader arrives, which is the hero's entrance
 * played once more at the other end.
 *
 * There is no index of the sub-pages here any more. It duplicated the footer
 * directly below it and the navbar directly above, and three menus stacked at
 * the end of a long scroll is a page that cannot decide how to finish. The
 * closing is the invitation, and the deep pages are linked from the scenes they
 * belong to, where the reader is already thinking about that subject.
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
