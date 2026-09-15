"use client";

import React from "react";
import gsap from "gsap";

import { Marquee } from "@/components/marketing/_shared/marquee";
import { useHolofote } from "@/components/marketing/_shared/use-holofote";
import {
  SCENE_ANY_WIDTH,
  useScrollScene,
  CENA_REPETE,
} from "@/components/marketing/_shared/use-scroll-scene";
import { APP_NAME } from "@/lib/site/app-brand";

import { FRASES, OPERACOES } from "../_content/comandos";

/**
 * A parede de pedidos, e depois as seis coisas que a categoria não faz.
 *
 * A parede vem primeiro de propósito. Quem chega numa página destas não está
 * perguntando quais são os recursos, está perguntando se o agente entende do
 * jeito dele. Dezesseis pedidos crus, em minúsculas, respondem isso em dois
 * segundos e sem animar nada de caro: duas faixas em sentidos contrários, que é
 * o que as faz lerem como uma massa de conversa e não como um carrossel.
 *
 * As seis operações vêm depois, e são a prova. Cada uma tem uma ferramenta
 * determinística por trás no repositório do aplicativo; `comandos.ts` registra
 * qual, e essa é a regra para acrescentar uma sétima.
 *
 * O holofote é um listener só, no contêiner da grade, escrevendo `--mx`/`--my`
 * no cartão sob o cursor. A luz atravessa de um cartão para o outro como uma
 * coisa em movimento, em vez de acender e apagar por caixa, e o React não
 * re-renderiza nada a cada movimento do mouse.
 */
export function AplicativoComandos() {
  const secao = React.useRef<HTMLElement>(null);
  const grade = useHolofote<HTMLDivElement>();

  /**
   * UM ScrollTrigger para a grade inteira, com `stagger`, e não um por cartão.
   *
   * Eram sete, um por elemento com `.comando-card`. `ScrollTrigger.create` faz
   * medição de layout SÍNCRONA, e todos eles nascem na hidratação: é a mesma
   * conta que custou ~1,7s de TBT na home do ERP e que fez o `useScrollProgress`
   * passar a criar o trigger tarde, por IntersectionObserver. Sete viraram um, e
   * o efeito na tela é o mesmo, porque `stagger` escalona melhor do que um
   * `delay` calculado por índice.
   */
  useScrollScene(
    secao,
    () => {
      const cartoes = gsap.utils.toArray<HTMLElement>(".comando-card");
      if (!cartoes.length) return;
      const tween = gsap.fromTo(
        cartoes,
        { y: 26, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.7,
          ease: "expo.out",
          stagger: 0.07,
          scrollTrigger: {
            trigger: cartoes[0],
            start: "top 90%",
            toggleActions: CENA_REPETE,
          },
        },
      );
      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
      };
    },
    { query: SCENE_ANY_WIDTH },
  );

  return (
    <section
      ref={secao}
      id="comandos"
      className="overflow-hidden border-t border-white/[0.06] bg-[var(--app-bg)] py-28 text-[var(--app-text)] md:py-36"
    >
      <div className="mx-auto max-w-5xl px-6 md:px-10">
        <p className="mb-4 inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--app-tint)]">
          <span className="h-px w-7 bg-[var(--app-tint)]/50" />
          O que você pode pedir
        </p>

        <h2 className="max-w-2xl [font-family:var(--font-hanken)] text-3xl font-bold leading-[1.1] tracking-[-0.02em] md:text-5xl">
          Escreva como você falaria.
        </h2>

        <p className="mt-6 max-w-xl text-base leading-relaxed text-[var(--app-text-muted)]">
          Sem comando, sem formato, sem palavra reservada. Por texto ou por
          áudio, no WhatsApp ou dentro do aplicativo.
        </p>
      </div>

      {/* A parede sangra até as bordas: contida numa coluna de 5xl ela lê como
          um carrossel de depoimentos, e o que se quer é uma massa. */}
      <div className="relative mt-14 md:mt-16">
        <Faixa frases={FRASES} />
        <Faixa frases={[...FRASES].reverse()} invertido className="mt-3" />

        {/* As bordas dissolvem, senão as frases nascem e morrem cortadas na
            aresta da tela e a faixa parece uma lista com overflow. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-[linear-gradient(90deg,var(--app-bg),transparent)] md:w-40"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-[linear-gradient(270deg,var(--app-bg),transparent)] md:w-40"
        />
      </div>

      <div className="mx-auto mt-20 max-w-5xl px-6 md:mt-24 md:px-10">
        <h3 className="max-w-2xl [font-family:var(--font-hanken)] text-2xl font-bold leading-[1.15] tracking-[-0.02em] md:text-4xl">
          E ele não para em anotar.
        </h3>

        <div
          ref={grade}
          className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {OPERACOES.map((operacao) => (
            <article
              key={operacao.pedido}
              data-holofote
              className="comando-card holofote relative overflow-hidden rounded-3xl border border-[var(--app-card-border)] bg-[var(--app-surface)] p-6 md:p-7"
            >
              <p className="relative [font-family:var(--font-jetbrains-mono)] text-sm leading-snug text-[var(--app-tint)]">
                {operacao.pedido}
              </p>
              <p className="relative mt-4 text-sm leading-relaxed text-[var(--app-text-muted)]">
                {operacao.efeito}
              </p>
            </article>
          ))}
        </div>

        {/* A faixa de cota, que era o fecho da antiga seção "Um agente, dois
            lugares". Ela sobrevive porque diz a única coisa desta página que as
            pessoas assumem ao contrário: as conversas são separadas, o limite
            mensal é o mesmo para as duas. */}
        <div className="comando-card mt-4 rounded-3xl border border-[var(--app-card-border)] bg-[var(--app-surface)] p-7 md:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <p className="[font-family:var(--font-hanken)] text-base font-semibold">
              Conversas separadas, cota única
            </p>
            <p className="[font-family:var(--font-jetbrains-mono)] text-sm text-[var(--app-text-muted)]">
              6/100 · 2 WhatsApp · 4 no app
            </p>
          </div>
          <div
            aria-hidden="true"
            className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--app-element)]"
          >
            <span className="block h-full w-[6%] rounded-full bg-[var(--app-tint)]" />
          </div>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-[var(--app-text-muted)]">
            O que você conversa no WhatsApp não se mistura com o que você
            conversa dentro da {APP_NAME}. O limite mensal, sim, é o mesmo para
            os dois.
          </p>
        </div>
      </div>
    </section>
  );
}

function Faixa({
  frases,
  invertido = false,
  className,
}: {
  frases: string[];
  invertido?: boolean;
  className?: string;
}) {
  return (
    <Marquee duracao={54} invertido={invertido} className={className}>
      {frases.map((frase) => (
        <span
          key={frase}
          className="mx-1.5 whitespace-nowrap rounded-full border border-[var(--app-card-border)] bg-[var(--app-surface)] px-5 py-3 [font-family:var(--font-jetbrains-mono)] text-sm text-[var(--app-text-muted)]"
        >
          {frase}
        </span>
      ))}
    </Marquee>
  );
}
