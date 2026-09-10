"use client";

import React, { useRef } from "react";
import gsap from "gsap";

import {
  SCENE_ANY_WIDTH,
  useScrollScene,
} from "@/components/marketing/_shared/use-scroll-scene";

import type { Vaga } from "@/app/institucional/_content/institucional-copy";

const EMAIL = "gestao@proops.com.br";

/**
 * The openings, and the empty state that is just as likely.
 *
 * An empty list is a REAL state here, not a gap to be filled before launch: a
 * small company is between hires most of the year. Rendering nothing would make
 * the page look broken, and hiding the section would make someone who arrived
 * from a job search think they landed on the wrong page. So the empty case says
 * so plainly and gives them the one thing that still works, which is writing in.
 *
 * The rows animate with `useScrollScene` rather than with a progress pipe: this
 * is a short list that either arrives or does not, and a scrub would mean a job
 * title fading back out as the reader scrolls up to re-read it.
 */
export function Vagas({ vagas }: { vagas: Vaga[] }) {
  const escopo = useRef<HTMLDivElement>(null);

  useScrollScene(
    escopo,
    () => {
      const linhas = gsap.utils.toArray<HTMLElement>(".vaga-linha");
      if (!linhas.length) return;
      const tween = gsap.fromTo(
        linhas,
        { y: 24, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.65,
          ease: "expo.out",
          stagger: 0.07,
          scrollTrigger: {
            trigger: escopo.current,
            start: "top 85%",
            once: true,
            invalidateOnRefresh: true,
          },
        },
      );
      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
      };
    },
    { query: SCENE_ANY_WIDTH, dependencies: [vagas.length] },
  );

  if (vagas.length === 0) {
    return (
      <div
        ref={escopo}
        className="vaga-linha border-y border-white/10 px-6 py-16 text-center md:px-10 md:py-20"
      >
        <p className="[font-family:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.24em] text-white/40">
          Nenhuma vaga aberta
        </p>
        <p className="mx-auto mt-6 max-w-xl [font-family:var(--font-bricolage)] text-2xl font-semibold leading-snug tracking-tight text-white md:text-3xl">
          Não tem nada aberto agora, e isso muda rápido.
        </p>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-white/55 md:text-base">
          Se você leu o resto desta página e se reconheceu, escreva mesmo assim.
          A gente guarda, e as duas últimas contratações começaram exatamente
          assim.
        </p>
        <a
          href={`mailto:${EMAIL}?subject=Trabalhar na ProOps`}
          className="group mt-9 inline-flex items-center gap-2 border-b border-white/25 pb-1 text-sm text-white transition-colors hover:border-white"
        >
          Escrever para {EMAIL}
          <span
            aria-hidden="true"
            className="inline-block transition-transform duration-300 group-hover:translate-x-1"
          >
            &rarr;
          </span>
        </a>
      </div>
    );
  }

  return (
    <div ref={escopo} className="border-t border-white/10">
      {vagas.map((vaga) => (
        <a
          key={`${vaga.titulo}-${vaga.area}`}
          href={`mailto:${EMAIL}?subject=${encodeURIComponent(`Vaga: ${vaga.titulo}`)}`}
          className="vaga-linha group grid gap-3 border-b border-white/10 py-8 transition-colors hover:bg-white/[0.03] md:grid-cols-[2fr_1fr_1fr_auto] md:items-center md:gap-8"
        >
          <h3 className="[font-family:var(--font-bricolage)] text-xl font-semibold tracking-tight text-white md:text-2xl">
            {vaga.titulo}
          </h3>
          <p className="[font-family:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.18em] text-white/45">
            {vaga.area}
          </p>
          <p className="text-sm text-white/55">
            {vaga.local}, {vaga.tipo}
          </p>
          <span
            aria-hidden="true"
            className="text-white/45 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-white"
          >
            &rarr;
          </span>
        </a>
      ))}
    </div>
  );
}
