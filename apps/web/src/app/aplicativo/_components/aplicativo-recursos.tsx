"use client";

import React from "react";
import gsap from "gsap";

import { LiquidGlass } from "@/components/marketing/_shared/liquid-glass";
import { PauseOffscreen } from "@/components/marketing/_shared/pause-offscreen";
import {
  SCENE_ANY_WIDTH,
  useScrollScene,
} from "@/components/marketing/_shared/use-scroll-scene";

interface Recurso {
  titulo: string;
  texto: string;
  /** Column span above md. The grid is four wide, so 2 is half and 4 is full. */
  span: string;
}

const RECURSOS: Recurso[] = [
  {
    titulo: "Não pergunta quanto você tem, responde se dá para gastar",
    texto:
      "A tela inicial é ancorada na sobra projetada até o fim do mês, contando o que ainda vai entrar e o que ainda vai sair. Saldo bruto no dia 3 não diz nada.",
    span: "md:col-span-2 md:row-span-2",
  },
  {
    titulo: "Confirma antes de agir",
    texto:
      "Gasto grande vira uma pendência que pede um sim. A assistente não executa sozinha o que é difícil de desfazer.",
    span: "md:col-span-2",
  },
  {
    titulo: "Importa o extrato do banco",
    texto:
      "OFX ou CSV, com fila de revisão item a item. As regras que você cria categorizam o resto sozinhas na próxima vez.",
    span: "md:col-span-2",
  },
  {
    titulo: "Cartões, faturas e parcelas",
    texto:
      "Fatura com dia de fechamento próprio, pagamento parcial, compra parcelada e financiamento ancorado no vencimento do contrato.",
    span: "md:col-span-2",
  },
  {
    titulo: "Até cinco pessoas, um financeiro",
    texto:
      "O plano Família junta a casa na mesma base, com autoria por lançamento: dá para ver quem registrou o quê.",
    span: "md:col-span-2",
  },
];

/**
 * The rest of the product, in a bento.
 *
 * Sized by weight rather than by symmetry: the projected-balance idea is the
 * one that separates this app from a spreadsheet, so it gets the double tile.
 */
export function AplicativoRecursos() {
  const sectionRef = React.useRef<HTMLElement>(null);

  useScrollScene(
    sectionRef,
    () => {
      gsap.utils
        .toArray<HTMLElement>(".recurso-card")
        .forEach((card, index) => {
          gsap.fromTo(
            card,
            { y: 26, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.7,
              delay: (index % 3) * 0.07,
              ease: "expo.out",
              scrollTrigger: { trigger: card, start: "top 90%", once: true },
            },
          );
        });
    },
    { query: SCENE_ANY_WIDTH },
  );

  return (
    <section
      ref={sectionRef}
      className="border-t border-white/[0.06] bg-[var(--app-bg)] px-6 py-28 text-[var(--app-text)] md:px-10 md:py-36"
    >
      <div className="mx-auto max-w-5xl">
        <p className="mb-4 inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--app-tint)]">
          <span className="h-px w-7 bg-[var(--app-tint)]/50" />O que mais tem
          dentro
        </p>

        <h2 className="max-w-2xl [font-family:var(--font-hanken)] text-3xl font-bold leading-[1.1] tracking-[-0.02em] md:text-5xl">
          Financeiro de verdade, não uma lista de gastos.
        </h2>

        <PauseOffscreen className="mt-14 grid auto-rows-fr gap-4 md:mt-16 md:grid-cols-4">
          {RECURSOS.map((recurso, index) => (
            <LiquidGlass
              key={recurso.titulo}
              as="article"
              className={`recurso-card flex flex-col justify-between rounded-3xl p-7 md:p-8 ${recurso.span}`}
              delaySeconds={2 + index * 0.9}
            >
              <h3 className="[font-family:var(--font-hanken)] text-lg font-semibold leading-snug tracking-tight md:text-xl">
                {recurso.titulo}
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-[var(--app-text-muted)]">
                {recurso.texto}
              </p>
            </LiquidGlass>
          ))}
        </PauseOffscreen>
      </div>
    </section>
  );
}
