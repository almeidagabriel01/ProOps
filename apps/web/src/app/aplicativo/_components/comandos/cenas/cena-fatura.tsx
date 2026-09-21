"use client";

import React from "react";
import gsap from "gsap";

import { Dinheiro } from "../../telas/pecas";
import { useCena } from "../use-cena";
import { Check, Moeda, Rotulo, Superficie, useValores } from "./pecas-da-cena";
import type { PropsDaCena } from "./tipos";

/** Somam R$ 1.590,00, a fatura da cena "Sem sair da conversa". */
const ITENS = [
  { titulo: "Mercado", valor: "R$ 412,30" },
  { titulo: "Farmácia", valor: "R$ 86,90" },
  { titulo: "Marcenaria, 2 de 5", valor: "R$ 320,00" },
  { titulo: "Posto", valor: "R$ 250,00" },
  { titulo: "Streaming", valor: "R$ 55,90" },
  { titulo: "Restaurante", valor: "R$ 464,90" },
];

const LIMITE = 7500;
const ANTES = 4337;
const DEPOIS = 5927;

/**
 * "paguei a fatura do cartão".
 *
 * Pagar uma fatura é mexer em cada parcela que entrou nela, e a cena mostra
 * exatamente isso: os seis itens são baixados um a um, com o check se
 * desenhando, e o limite disponível sobe junto, na mesma cadência. O número e a
 * barra chegam ao fim ao mesmo tempo que o último check, porque é uma operação
 * só, não sete.
 */
export function CenaFatura({ armado, progresso, tocar }: PropsDaCena) {
  const raiz = React.useRef<HTMLDivElement>(null);
  const [valores, definir] = useValores({ disponivel: DEPOIS });

  useCena(
    raiz,
    (tl, { acompanhar }) => {
      const q = gsap.utils.selector(raiz);
      const linhas = q<HTMLElement>(".fatura-linha");
      const passo = 0.28;
      const inicio = 0.7;

      tl.fromTo(
        q(".fatura-cabeca, .fatura-limite"),
        { autoAlpha: 0, y: 12 },
        { autoAlpha: 1, y: 0, duration: 0.6, ease: "expo.out", stagger: 0.1 },
        0.05,
      )
        .fromTo(
          linhas,
          { autoAlpha: 0, x: -10 },
          {
            autoAlpha: 1,
            x: 0,
            duration: 0.45,
            ease: "power3.out",
            stagger: 0.05,
          },
          0.15,
        )
        .fromTo(
          q(".fatura-barra"),
          { scaleX: ANTES / DEPOIS },
          {
            scaleX: 1,
            duration: passo * linhas.length + 0.3,
            ease: "power1.inOut",
          },
          inicio,
        );

      linhas.forEach((linha, i) => {
        const em = inicio + i * passo;
        tl.fromTo(
          linha.querySelector(".cena-check-traco"),
          { strokeDashoffset: 1 },
          { strokeDashoffset: 0, duration: 0.35, ease: "power2.out" },
          em,
        )
          .fromTo(
            linha.querySelector(".cena-check-anel"),
            { scale: 0.4, transformOrigin: "50% 50%", opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(2.6)" },
            em,
          )
          .fromTo(
            linha.querySelectorAll(".fatura-texto"),
            { opacity: 1 },
            { opacity: 0.5, duration: 0.3 },
            em + 0.1,
          );
      });

      tl.fromTo(
        q(".fatura-selo"),
        { autoAlpha: 0, scale: 0.6 },
        { autoAlpha: 1, scale: 1, duration: 0.5, ease: "back.out(2.4)" },
        inicio + linhas.length * passo + 0.1,
      );

      acompanhar((tempo) =>
        definir({ disponivel: tempo >= inicio + 0.2 ? DEPOIS : ANTES }),
      );

      return () => definir({ disponivel: DEPOIS });
    },
    { armado, progresso, tocar },
  );

  return (
    <div
      ref={raiz}
      className="grid h-full gap-5 md:grid-cols-[1.25fr_1fr] md:items-center md:gap-8"
    >
      <Superficie className="p-4 md:p-5">
        <div className="fatura-cabeca flex items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
          <div>
            <Rotulo>Fatura de setembro</Rotulo>
            <Dinheiro className="text-lg font-semibold text-[var(--app-text)]">
              R$ 1.590,00
            </Dinheiro>
          </div>
          <span className="fatura-selo rounded-full bg-[var(--app-tint)]/15 px-3 py-1 text-xs font-semibold text-[var(--app-tint)]">
            Paga
          </span>
        </div>
        <ul className="mt-1">
          {ITENS.map((item) => (
            <li
              key={item.titulo}
              className="fatura-linha flex items-center gap-3 py-1.5 md:py-2"
            >
              <Check />
              <span className="fatura-texto min-w-0 flex-1 truncate text-sm text-[var(--app-text)]">
                {item.titulo}
              </span>
              <Dinheiro className="fatura-texto text-sm text-[var(--app-text)]">
                {item.valor}
              </Dinheiro>
            </li>
          ))}
        </ul>
      </Superficie>

      <div className="fatura-limite">
        <Rotulo>Disponível no cartão</Rotulo>
        <Moeda
          valor={valores.disponivel}
          duracao={1900}
          className="mt-1 block text-3xl font-semibold tracking-[-0.03em] text-[var(--app-text)] md:text-4xl"
        />
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--app-element)]">
          <div
            style={{ width: `${(DEPOIS / LIMITE) * 100}%` }}
            className="h-full"
          >
            <div className="fatura-barra h-full origin-left rounded-full bg-[var(--app-tint)]" />
          </div>
        </div>
        <p className="mt-2 flex justify-between text-xs text-[var(--app-text-muted)]">
          <span>Limite de R$ 7.500,00</span>
          <span>+ R$ 1.590,00</span>
        </p>
      </div>
    </div>
  );
}
