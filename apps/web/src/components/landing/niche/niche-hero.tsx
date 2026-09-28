import React from "react";

import { JanelaDoErp } from "@/components/marketing/mocks/janela-do-erp";
import { TelaPropostaDoNicho } from "@/components/marketing/mocks/telas/tela-proposta-do-nicho";
import { calcularProposta } from "@/lib/landing/proposta-de-exemplo";
import type { NicheVocabulary } from "@/lib/niches/vocabulary";
import { formatCurrency } from "@/utils/format";

import { NicheHeroCtas } from "./niche-hero-ctas";
import type { NicheLandingConfig } from "./types";

interface NicheHeroProps {
  hero: NicheLandingConfig["hero"];
  proposta: NicheLandingConfig["propostaExemplo"];
  vocabulario: NicheVocabulary;
}

/**
 * O herói da landing de nicho: o título com o nome do nicho na cor dele, e ao
 * lado uma proposta DESSE nicho aberta no ERP (grupos com o vocabulário dele,
 * medidas como no PDF, totais do motor de preço).
 *
 * Componente de servidor. A entrada é keyframe CSS (`hero-enter`), porque este
 * é o bloco do LCP; a única ilha é a dos botões.
 */
export function NicheHero({ hero, proposta, vocabulario }: NicheHeroProps) {
  const total = calcularProposta(proposta).total;
  const atraso = (s: number, y = 18) => ({ "--hero-delay": `${s}s`, "--hero-y": `${y}px` }) as React.CSSProperties;

  return (
    <section className="relative overflow-hidden bg-white pb-20 pt-32 dark:bg-neutral-950 md:pb-28 md:pt-40">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-16">
        <div>
          <h1
            className="hero-enter [font-family:var(--font-pdf-montserrat)] text-[2.5rem] font-bold leading-[1.02] tracking-[-0.035em] text-black dark:text-white sm:text-6xl lg:text-[4.25rem]"
            style={atraso(0, 22)}
          >
            {hero.title}{" "}
            <em className="texto-acento [font-family:var(--font-pdf-playfair)] font-medium italic tracking-[-0.02em]">
              {hero.titleHighlight}
            </em>
          </h1>
          <p className="hero-enter mt-6 max-w-xl text-lg leading-relaxed text-black/60 dark:text-white/60" style={atraso(0.1)}>
            {hero.subtitle}
          </p>
          <div className="hero-enter mt-9" style={atraso(0.2, 12)}>
            <NicheHeroCtas primario={hero.primaryCta} secundario={hero.secondaryCta} />
          </div>
          <ul className="hero-enter mt-10 flex flex-wrap gap-x-6 gap-y-2" style={atraso(0.3, 10)}>
            {hero.provas.map((prova) => (
              <li key={prova} className="flex items-center gap-2 text-sm font-medium text-black/70 dark:text-white/70">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--acento)]" />
                {prova}
              </li>
            ))}
          </ul>
        </div>

        <div className="hero-enter relative" style={atraso(0.25, 30)}>
          <JanelaDoErp proporcao="16 / 12">
            <TelaPropostaDoNicho proposta={proposta} vocabulario={vocabulario} />
          </JanelaDoErp>
          <div className="absolute -bottom-6 left-4 rounded-2xl border border-black/10 bg-white px-4 py-3 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.4)] dark:border-white/12 dark:bg-neutral-900 sm:-left-6">
            <span>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-black/45 dark:text-white/45">
                Calculado na proposta
              </span>
              <span className="texto-acento block [font-family:var(--font-pdf-montserrat)] text-xl font-bold tabular-nums">
                {formatCurrency(total)}
              </span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
