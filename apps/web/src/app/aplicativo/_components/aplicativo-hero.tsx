import React from "react";

import { LandingButton } from "@/components/landing/_shared/landing-button";
import { Magnetic } from "@/components/marketing/_shared/magnetic";

import { AppHeroPhone } from "./app-hero-phone";

/**
 * O herói abre na diferença, não na descrição.
 *
 * A copy anterior era "Você manda uma mensagem. A IA organiza." Ela é verdadeira
 * e é, quase palavra por palavra, o que os cinco concorrentes diretos dizem no
 * próprio herói. Numa página cujo objetivo declarado é se separar da categoria,
 * a primeira linha não pode ser a frase da categoria.
 *
 * A copy fica à esquerda e o telefone à direita, então o título é o elemento de
 * LCP e pinta por `.hero-enter` no primeiro paint, sem JavaScript. O telefone
 * mostra a captura real da aba Hoje (ver `app-hero-phone.tsx`): acima da dobra
 * nada aqui depende de biblioteca de animação.
 *
 * O `Magnetic` do CTA é a única ilha de cliente acima da dobra, e ele não anexa
 * listener nenhum em touch nem sob `prefers-reduced-motion`.
 */
export function AplicativoHero() {
  return (
    <section className="relative overflow-hidden bg-[var(--app-bg)] px-6 pb-24 pt-32 text-[var(--app-text)] md:px-10 md:pb-28 md:pt-36">
      {/* O campo lê `--px`/`--py` do `PointerFieldProvider` da página, então a
          reatividade inteira é CSS herdando duas variáveis, sem um render do
          React por movimento do mouse. Parado, ele é a luz que já existia. */}
      <div aria-hidden="true" className="campo-app" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
        <div>
          <p
            className="hero-enter mb-7 inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--app-tint)]"
            style={
              {
                "--hero-y": "-10px",
                "--hero-blur": "6px",
                "--hero-dur": "0.5s",
              } as React.CSSProperties
            }
          >
            <span className="h-px w-7 bg-[var(--app-tint)]/50" />
            Finanças pessoais
          </p>

          <h1
            className="hero-enter [font-family:var(--font-hanken)] text-4xl font-bold leading-[1.06] tracking-[-0.03em] md:text-6xl"
            style={
              {
                "--hero-y": "22px",
                "--hero-delay": "0.1s",
              } as React.CSSProperties
            }
          >
            Todo app anota o seu gasto.
            <br />
            <span className="text-[var(--app-tint)]">Este resolve o resto.</span>
          </h1>

          <p
            className="hero-enter mt-7 max-w-xl text-base leading-relaxed text-[var(--app-text-muted)] md:text-lg"
            style={
              {
                "--hero-y": "16px",
                "--hero-delay": "0.22s",
              } as React.CSSProperties
            }
          >
            Transferência, parcela, fatura e a projeção do mês. Por mensagem no
            WhatsApp ou dentro do aplicativo, por texto ou por áudio.
          </p>

          <div
            className="hero-enter mt-10 flex flex-col gap-4 sm:flex-row sm:items-center"
            style={
              {
                "--hero-y": "12px",
                "--hero-delay": "0.34s",
                "--hero-dur": "0.5s",
              } as React.CSSProperties
            }
          >
            <Magnetic>
              <LandingButton href="#planos" variant="inverted" size="lg">
                Ver os planos
              </LandingButton>
            </Magnetic>
            <p className="text-sm text-[var(--app-text-muted)]">
              Em breve na App Store e no Google Play.
            </p>
          </div>
        </div>

        {/* `lg:-mt-10`: com as colunas centradas, a coluna do texto é mais
            alta e empurrava o aparelho para baixo da dobra. */}
        <div
          className="hero-enter lg:-mt-10"
          style={
            {
              "--hero-y": "26px",
              "--hero-delay": "0.3s",
              "--hero-dur": "0.8s",
            } as React.CSSProperties
          }
        >
          <AppHeroPhone />
        </div>
      </div>
    </section>
  );
}
