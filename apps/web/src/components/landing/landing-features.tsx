"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { HidratarPerto } from "@/components/marketing/_shared/hidratar-perto";
import { etapasDaObra } from "@/components/marketing/mocks/dados";
import {
  DESTAQUES,
  FUNCIONALIDADES,
  caminhoDaFuncionalidade,
  recurso,
  seloDoPlano,
} from "@/lib/landing/funcionalidades";
import { DEFAULT_NICHE, NICHE_REGISTRY } from "@/lib/niches/registry";
import { cn } from "@/lib/utils";

import { LandingButton } from "./_shared/landing-button";
import { Accent, SectionHeading } from "./_shared/section-heading";
import { CenaDoDestaque } from "./recursos/palco-dos-destaques";

const ETAPAS = etapasDaObra(NICHE_REGISTRY[DEFAULT_NICHE].stageTemplate, 1);

/**
 * Os cinco destaques, lado a lado com o palco.
 *
 * No desktop com movimento, a lista rola e o palco fica: a linha que passa
 * pelo meio da tela vira a ativa, abre os detalhes e troca a cena do palco.
 * O único JavaScript é um IntersectionObserver que escreve o índice ativo; a
 * troca de cena e a entrada de cada uma são CSS.
 *
 * No celular, ou com movimento reduzido, não há palco: cada destaque traz a
 * própria cena embaixo dele, com os detalhes abertos. As duas formas estão no
 * HTML e o CSS escolhe (`lg:motion-safe`), a regra da casa para hidratar igual
 * em qualquer preferência.
 */
function Destaques() {
  const [ativo, setAtivo] = useState(0);
  const linhas = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (!entrada.isIntersecting) continue;
          const indice = linhas.current.indexOf(entrada.target as HTMLLIElement);
          if (indice >= 0) setAtivo(indice);
        }
      },
      { rootMargin: "-48% 0px -48% 0px" },
    );
    linhas.current.forEach((el) => el && observador.observe(el));
    return () => observador.disconnect();
  }, []);

  return (
    <div className="destaques mt-16 grid gap-14 lg:mt-20 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
      <ol className="relative">
        {DESTAQUES.map((destaque, i) => {
          const principal = recurso(destaque.principal);
          const selo = seloDoPlano(principal.requisito);
          return (
            <li
              key={destaque.id}
              ref={(el) => {
                linhas.current[i] = el;
              }}
              data-ativo={i === ativo ? "" : undefined}
              className="destaque relative border-t border-black/10 py-9 pl-6 dark:border-white/10 lg:motion-safe:flex lg:motion-safe:min-h-[58vh] lg:motion-safe:flex-col lg:motion-safe:justify-center"
            >
              <span aria-hidden="true" className="destaque-barra absolute left-0 top-9 w-px bg-black dark:bg-white" />
              <h3 className="destaque-titulo [font-family:var(--font-pdf-montserrat)] text-2xl font-bold leading-tight tracking-[-0.02em] md:text-[1.75rem]">
                <Link
                  href={caminhoDaFuncionalidade(destaque.funcionalidade)}
                  className="underline-offset-[6px] hover:underline"
                >
                  {destaque.titulo}
                </Link>
              </h3>
              <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-black/60 dark:text-white/60 md:text-base">
                {destaque.frase}
              </p>
              <div className="destaque-corpo">
                <div>
                  <ul className="mt-5 flex max-w-lg flex-wrap gap-2">
                    {destaque.recursos.map((id) => (
                      <li
                        key={id}
                        className="rounded-full border border-black/12 px-3 py-1 text-[13px] text-black/70 dark:border-white/15 dark:text-white/70"
                      >
                        {recurso(id).titulo}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
                    <span className="font-semibold text-black dark:text-white">{selo.rotulo}</span>
                    {selo.rotuloAddon ? (
                      <span className="text-black/50 dark:text-white/50">{selo.rotuloAddon}</span>
                    ) : null}
                    <Link
                      href={caminhoDaFuncionalidade(destaque.funcionalidade)}
                      aria-label={`Saiba mais: ${destaque.titulo}`}
                      className="inline-flex items-center gap-1 font-semibold text-black underline decoration-black/25 underline-offset-4 transition-colors hover:decoration-black dark:text-white dark:decoration-white/30 dark:hover:decoration-white"
                    >
                      Saiba mais
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </div>
                </div>
              </div>
              {/* A cena de cada destaque, para quem não tem o palco. */}
              <div aria-hidden="true" className="mt-8 aspect-[4/3.2] lg:motion-safe:hidden">
                <div className="destaque-camada h-full" data-ativo="">
                  <CenaDoDestaque id={destaque.id} etapas={ETAPAS} />
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div aria-hidden="true" className="hidden lg:motion-safe:block">
        <div className="sticky top-[calc(50vh-17rem)] aspect-[4/3.4]">
          {DESTAQUES.map((destaque, i) => (
            <div
              key={destaque.id}
              data-ativo={i === ativo ? "" : undefined}
              className={cn("destaque-camada destaque-camada-palco absolute inset-0")}
            >
              <CenaDoDestaque id={destaque.id} etapas={ETAPAS} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * "Recursos da plataforma": os cinco recursos que explicam por que alguém
 * troca de sistema. Cada um abre a página da funcionalidade dele, e o botão do
 * fim leva à lista inteira em `/funcionalidades`.
 * Hospeda as âncoras `#recursos` e `#modulos` (a antiga seção Módulos).
 */
export function LandingFeatures() {
  return (
    <section
      id="recursos"
      className="relative border-t border-black/10 bg-white py-28 dark:border-white/10 dark:bg-neutral-950"
    >
      {/* âncora herdada da antiga seção Módulos: links de fora ainda a usam */}
      <span id="modulos" aria-hidden className="absolute -top-24" />

      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          align="left"
          title={
            <>
              Do orçamento ao recibo, <Accent>sem trocar de sistema</Accent>
            </>
          }
          description="Cinco coisas que a ProOps faz e uma planilha não faz. Clique em cada uma para ver como funciona."
        />

        <HidratarPerto>
          <Destaques />
        </HidratarPerto>

        <div className="mt-16 flex flex-col items-start gap-4 border-t border-black/10 pt-10 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[15px] text-black/60 dark:text-white/60">
            {FUNCIONALIDADES.length} funcionalidades, cada uma com a sua página e o plano que a libera.
          </p>
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
    </section>
  );
}
