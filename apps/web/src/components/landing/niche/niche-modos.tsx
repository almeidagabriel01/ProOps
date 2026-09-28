import React from "react";

import type { NicheLandingConfig } from "./types";

interface NicheModosProps {
  secao: NicheLandingConfig["modulesSection"];
  modulos: NicheLandingConfig["modules"];
}

/**
 * Os módulos do nicho como uma ficha técnica: três colunas separadas por
 * filete, sem card em volta. Nos nichos com preço por medida, cada coluna é um
 * modo de cobrança (o mesmo que dá nome às abas da cena acima).
 */
export function NicheModos({ secao, modulos }: NicheModosProps) {
  return (
    <section className="border-t border-black/10 bg-white py-24 dark:border-white/10 dark:bg-neutral-950 md:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <h2 className="max-w-3xl [font-family:var(--font-pdf-montserrat)] text-[2.1rem] font-bold leading-[1.06] tracking-[-0.025em] text-black dark:text-white md:text-5xl">
          {secao.title}
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-black/60 dark:text-white/60 md:text-lg">
          {secao.subtitle}
        </p>
        <div className="mt-14 grid border-y border-black/10 dark:border-white/10 md:grid-cols-3">
          {modulos.map((modulo) => {
            const Icone = modulo.icon;
            return (
              <article
                key={modulo.title}
                className="vt-revela border-black/10 py-10 first:border-t-0 dark:border-white/10 max-md:border-t md:border-l md:px-8 md:first:border-l-0 md:first:pl-0"
              >
                <Icone className="h-6 w-6 text-[var(--acento)]" aria-hidden />
                <h3 className="mt-5 [font-family:var(--font-pdf-montserrat)] text-xl font-bold text-black dark:text-white">
                  {modulo.title}
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-black/60 dark:text-white/60">{modulo.description}</p>
                <ul className="mt-5 space-y-2 border-t border-black/10 pt-5 dark:border-white/10">
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
