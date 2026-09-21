import React from "react";

import { LandingButton } from "@/components/landing/_shared/landing-button";
import { Magnetic } from "@/components/marketing/_shared/magnetic";
import { SplitReveal } from "@/components/marketing/_shared/split-reveal";
import { APP_NAME } from "@/lib/site/app-brand";

/**
 * O fecho, revelado linha a linha.
 *
 * As quatro sub-páginas do site da empresa terminam assim, com `SplitReveal` em
 * `lines`, e a regra vale aqui inteira: uma página que passou por dez cenas com
 * movimento não pode terminar num bloco de `<p>` inerte. Foi como `/produtos`
 * ficou por um tempo, e a diferença é visível.
 *
 * `SplitReveal` escreve o estado inicial com um `gsap.set` em TODAS as unidades
 * antes do `fromTo`, e isso não é redundância: com `stagger`, o render imediato
 * do `fromTo` alcança só a primeira linha, e as outras ficam visíveis até a
 * sub-tween delas começar, quando saltam para invisível antes de subir. O que se
 * vê é um pisca. O E2E desta página afirma que, com a página no topo, toda
 * `.split-line` daqui está em `opacity: 0`.
 */
export function AplicativoFecho() {
  return (
    // O `aria-label` nomeia a região e, de quebra, é o que o E2E usa para
    // alcançar ESTE fecho: a galeria e os planos também revelam títulos com
    // `SplitReveal`, então um seletor por `.split-line` sozinho casaria três
    // seções e o guard do pisca não estaria medindo o que pensa medir.
    <section
      aria-label="O que a ProOps Pessoal resolve"
      className="border-t border-white/[0.06] bg-[var(--app-bg)] px-6 py-28 text-[var(--app-text)] md:px-10 md:py-40"
    >
      <div className="mx-auto max-w-3xl">
        <SplitReveal
          as="h2"
          unit="lines"
          className="[font-family:var(--font-hanken)] text-3xl font-bold leading-[1.15] tracking-[-0.02em] md:text-5xl"
        >
          Anotar o gasto é o começo do problema, não a solução dele.
        </SplitReveal>

        <SplitReveal
          unit="lines"
          className="mt-8 max-w-2xl text-base leading-relaxed text-[var(--app-text-muted)] md:text-lg"
        >
          {`A ${APP_NAME} existe para a parte que vem depois: a conta que vence hoje, a fatura que fecha dia 20, a compra que ainda não foi feita e talvez não deva ser. Você pede por mensagem, no WhatsApp ou dentro do aplicativo, e tem um financeiro inteiro por trás da resposta.`}
        </SplitReveal>

        <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center">
          <Magnetic>
            <LandingButton href="#planos" variant="inverted" size="lg">
              Ver os planos
            </LandingButton>
          </Magnetic>
          <p className="text-sm text-[var(--app-text-muted)]">
            Sete dias para testar. Em breve na App Store e no Google Play.
          </p>
        </div>
      </div>
    </section>
  );
}
