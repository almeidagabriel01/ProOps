import React from "react";

import { Accent } from "../_shared/section-heading";

import type { NicheLandingConfig } from "./types";

interface NicheModosProps {
  secao: NicheLandingConfig["modulesSection"];
  modulos: NicheLandingConfig["modules"];
}

/**
 * Os módulos do nicho como linhas de uma ficha técnica: o nome à esquerda, o
 * que ele faz no meio, os detalhes à direita. Linhas e não colunas iguais: a
 * leitura é de especificação, uma por vez. Nos nichos com preço por medida,
 * cada linha é um modo de cobrança (o mesmo que dá nome às abas da cena).
 */
export function NicheModos({ secao, modulos }: NicheModosProps) {
  return (
    <section className="border-t border-black/10 bg-white py-24 dark:border-white/10 dark:bg-neutral-950 md:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <h2 className="max-w-3xl [font-family:var(--font-pdf-montserrat)] text-[2.1rem] font-bold leading-[1.06] tracking-[-0.025em] text-black dark:text-white md:text-5xl">
          {secao.title} <Accent>{secao.titleHighlight}</Accent>
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-black/60 dark:text-white/60 md:text-lg">
          {secao.subtitle}
        </p>
        <div className="mt-14 border-b border-black/10 dark:border-white/10">
          {modulos.map((modulo) => {
            const Icone = modulo.icon;
            return (
              <article
                key={modulo.title}
                className="vt-revela grid gap-4 border-t border-black/10 py-9 dark:border-white/10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start lg:gap-12"
              >
                <h3 className="flex items-center gap-3 [font-family:var(--font-pdf-montserrat)] text-xl font-bold text-black dark:text-white md:text-2xl">
                  <Icone className="h-6 w-6 shrink-0 text-[var(--acento)]" aria-hidden />
                  {modulo.title}
                </h3>
                <p className="text-[15px] leading-relaxed text-black/60 dark:text-white/60 md:text-base">{modulo.description}</p>
                <ul className="space-y-2">
                  {modulo.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2.5 text-[14px] text-black/75 dark:text-white/75">
                      <span aria-hidden="true" className="mt-[0.55em] h-px w-3 shrink-0 bg-[var(--acento)]" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
