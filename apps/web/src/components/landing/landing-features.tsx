import React from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";

import { DESTAQUES, caminhoDaFuncionalidade, funcionalidade } from "@/lib/landing/funcionalidades";

import { LandingButton } from "./_shared/landing-button";
import { Accent, SectionHeading } from "./_shared/section-heading";

/**
 * "Recursos da plataforma": as cinco funcionalidades principais em lista
 * (título fixo à esquerda, linhas à direita), cada uma levando à página dela, e
 * o caminho para todas em `/funcionalidades`.
 *
 * Hospeda `#recursos`, para onde "Funcionalidades" da navbar rola, e `#modulos`
 * (a antiga seção Módulos, que links de fora ainda usam). A entrada das linhas
 * é CSS guiado pela rolagem (`vt-revela`), sem JavaScript.
 */
export function LandingFeatures() {
  return (
    <section
      id="recursos"
      className="relative scroll-mt-24 border-t border-black/10 bg-white py-28 dark:border-white/10 dark:bg-neutral-950"
    >
      <span id="modulos" aria-hidden className="absolute -top-24" />

      <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading
            align="left"
            eyebrow="Recursos da plataforma"
            title={
              <>
                Tudo que você precisa para <Accent>operar</Accent>
              </>
            }
            description="Os módulos que sustentam o dia a dia, do primeiro contato ao pós-venda, em uma base única e conectada."
          />
        </div>

        <div>
          <ol className="border-b border-black/10 dark:border-white/10">
            {DESTAQUES.map((destaque, index) => {
              const f = funcionalidade(destaque.funcionalidade);
              const Icone = f.icone;
              return (
                <li key={destaque.id} className="vt-revela">
                  <Link
                    href={caminhoDaFuncionalidade(f.slug)}
                    className="group relative flex items-start gap-5 border-t border-black/10 py-7 pl-6 pr-4 outline-none transition-colors duration-300 hover:bg-black/[0.025] focus-visible:bg-black/[0.03] focus-visible:ring-2 focus-visible:ring-black/30 dark:border-white/10 dark:hover:bg-white/[0.04] dark:focus-visible:ring-white/40 sm:gap-6"
                  >
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-1/2 h-0 w-[3px] -translate-y-1/2 rounded-full bg-black transition-all duration-300 ease-out group-hover:h-[56%] dark:bg-white"
                    />
                    <span
                      aria-hidden="true"
                      className="mt-1.5 hidden w-7 shrink-0 text-sm font-semibold tabular-nums text-black/30 transition-colors duration-300 group-hover:text-black/70 dark:text-white/30 dark:group-hover:text-white/70 sm:block"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="mt-0.5 grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-black/10 bg-black/[0.03] text-black transition-all duration-300 group-hover:-translate-y-0.5 group-hover:border-transparent group-hover:bg-black group-hover:text-white group-hover:shadow-[0_10px_24px_-10px_rgba(0,0,0,0.5)] dark:border-white/12 dark:bg-white/[0.06] dark:text-white dark:group-hover:bg-white dark:group-hover:text-black dark:group-hover:shadow-[0_10px_24px_-10px_rgba(0,0,0,0.8)]">
                      <Icone className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="flex-1 transition-transform duration-300 group-hover:translate-x-0.5">
                      <span className="block text-lg font-semibold text-black dark:text-white md:text-xl">{f.titulo}</span>
                      <span className="mt-1.5 block max-w-xl text-sm leading-relaxed text-black/60 dark:text-white/65 md:text-[15px]">
                        {destaque.frase}
                      </span>
                    </span>
                    <ArrowUpRight
                      aria-hidden
                      className="mt-2 h-5 w-5 shrink-0 text-black/30 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-black dark:text-white/30 dark:group-hover:text-white"
                    />
                  </Link>
                </li>
              );
            })}
          </ol>

          <div className="mt-10 flex justify-end">
            <LandingButton
              href="/funcionalidades"
              variant="solid"
              size="md"
              trailingIcon={<ArrowRight className="h-4 w-4" />}
            >
              Ver todas as funcionalidades
            </LandingButton>
          </div>
        </div>
      </div>
    </section>
  );
}
