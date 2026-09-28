import React from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";

import { CATALOGO, DESTAQUES, recurso, seloDoPlano } from "@/lib/landing/funcionalidades";

import { LandingButton } from "../_shared/landing-button";
import { Accent } from "../_shared/section-heading";

/**
 * O resto da plataforma, que é igual para todo nicho: os cinco destaques da
 * home, lidos do mesmo catálogo de `/funcionalidades`, com o plano de cada um.
 */
export function NichePlataforma() {
  return (
    <section className="border-t border-black/10 bg-white py-24 dark:border-white/10 dark:bg-neutral-950 md:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <h2 className="max-w-2xl [font-family:var(--font-pdf-montserrat)] text-[2.1rem] font-bold leading-[1.06] tracking-[-0.025em] text-black dark:text-white md:text-5xl">
            E o resto da operação, <Accent>no mesmo lugar</Accent>.
          </h2>
          <LandingButton href="/funcionalidades" variant="solid" size="md" trailingIcon={<ArrowRight className="h-4 w-4" />}>
            Ver as {CATALOGO.length} funcionalidades
          </LandingButton>
        </div>
        <ol className="mt-14 grid border-t border-black/10 dark:border-white/10 sm:grid-cols-2 lg:grid-cols-5">
          {DESTAQUES.map((destaque) => {
            const selo = seloDoPlano(recurso(destaque.principal).requisito);
            return (
              <li key={destaque.id} className="vt-revela border-b border-black/10 py-8 dark:border-white/10 sm:pr-6 lg:border-b-0 lg:border-r lg:px-6 lg:first:pl-0 lg:last:border-r-0">
                <h3 className="[font-family:var(--font-pdf-montserrat)] text-lg font-bold leading-snug text-black dark:text-white">
                  {destaque.titulo}
                </h3>
                <p className="mt-3 text-[14px] leading-relaxed text-black/60 dark:text-white/60">{destaque.frase}</p>
                <p className="mt-4 text-[12.5px] font-semibold text-black/75 dark:text-white/75">{selo.rotulo}</p>
                <Link
                  href={`/funcionalidades#${destaque.ancora}`}
                  className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-black underline decoration-black/25 underline-offset-4 hover:decoration-black dark:text-white dark:decoration-white/30 dark:hover:decoration-white"
                >
                  Ver no mapa
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
