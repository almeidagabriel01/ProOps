"use client";

import React from "react";
import gsap from "gsap";

import { Dinheiro } from "../../telas/pecas";
import { useCena } from "../use-cena";
import { Moeda, Rotulo, Superficie, useValores } from "./pecas-da-cena";
import type { PropsDaCena } from "./tipos";

const SOBRA = { antes: 1329.9, errada: 1284.9 };

const ANTERIORES = [
  { titulo: "Marcenaria", meta: "Casa, lançado no app", valor: "R$ 320,00" },
  { titulo: "Farmácia", meta: "Saúde, Cartão da casa", valor: "R$ 86,90" },
];

/**
 * "desfaz o último".
 *
 * A cena conta um engano e o conserto, nessa ordem: um lançamento entra,
 * empurrando a lista, e a sobra do mês cai; então o tempo volta. O glifo gira
 * ao contrário, a linha treme para trás como uma fita rebobinando, perde o
 * fundo e fica riscada, e a sobra volta ao que era.
 *
 * O estado final (o do servidor) é o da linha JÁ desfeita: tracejada, riscada e
 * marcada. Quem não vê a animação ainda lê a história inteira, porque o
 * lançamento desfeito continua ali, com o motivo escrito.
 */
export function CenaDesfazer({ armado, progresso }: PropsDaCena) {
  const raiz = React.useRef<HTMLDivElement>(null);
  const [valores, definir] = useValores({ sobra: SOBRA.antes });

  useCena(
    raiz,
    (tl, { acompanhar }) => {
      const q = gsap.utils.selector(raiz);
      const linha = q<HTMLElement>(".desfazer-linha")[0];
      if (!linha) return;
      const empurrao =
        linha.getBoundingClientRect().height +
        parseFloat(getComputedStyle(linha.parentElement!).rowGap || "0");

      // Antes do engano a linha é um lançamento comum: fundo cheio, sem risco,
      // sem marca. O servidor manda o estado DEPOIS do conserto.
      gsap.set(q(".desfazer-fundo"), { opacity: 1 });
      gsap.set(q(".desfazer-risco"), { scaleX: 0 });
      gsap.set(q(".desfazer-marca"), { autoAlpha: 0, x: 8 });
      gsap.set(linha, { opacity: 1 });

      tl.fromTo(
        q(".desfazer-cabeca"),
        { autoAlpha: 0, y: 10 },
        { autoAlpha: 1, y: 0, duration: 0.5, ease: "power3.out" },
        0.05,
      )
        // O lançamento errado entra por cima e empurra os outros.
        .fromTo(
          q(".desfazer-anterior"),
          { y: -empurrao },
          { y: 0, duration: 0.7, ease: "expo.out", stagger: 0.04 },
          0.5,
        )
        .fromTo(
          linha,
          { autoAlpha: 0, y: -18, scale: 0.97 },
          { autoAlpha: 1, y: 0, scale: 1, duration: 0.7, ease: "expo.out" },
          0.55,
        )
        // O rebobinar.
        .fromTo(
          q(".desfazer-glifo"),
          { rotation: 0, transformOrigin: "50% 50%" },
          { rotation: -360, duration: 1, ease: "power3.inOut" },
          2.3,
        )
        .to(
          linha,
          {
            keyframes: [
              { x: -10, filter: "blur(1.5px)", duration: 0.12 },
              { x: 5, filter: "blur(0.5px)", duration: 0.1 },
              { x: -3, filter: "blur(1px)", duration: 0.08 },
              { x: 0, filter: "blur(0px)", duration: 0.12 },
            ],
            ease: "power1.inOut",
          },
          2.5,
        )
        .to(q(".desfazer-fundo"), { opacity: 0, duration: 0.5 }, 2.85)
        .to(
          q(".desfazer-risco"),
          { scaleX: 1, duration: 0.5, ease: "power3.inOut" },
          2.85,
        )
        .to(linha, { opacity: 0.6, duration: 0.5 }, 2.9)
        .to(
          q(".desfazer-marca"),
          { autoAlpha: 1, x: 0, duration: 0.45, ease: "back.out(2)" },
          3.05,
        );

      // A sobra cai quando o engano entra e volta quando ele é desfeito.
      acompanhar((tempo) =>
        definir({
          sobra: tempo >= 0.9 && tempo < 2.9 ? SOBRA.errada : SOBRA.antes,
        }),
      );

      return () => definir({ sobra: SOBRA.antes });
    },
    { armado, progresso },
  );

  return (
    <div ref={raiz} className="flex h-full flex-col justify-center">
      <div className="desfazer-cabeca flex items-end justify-between gap-4">
        <div>
          <Rotulo>Sobra até o fim do mês</Rotulo>
          <Moeda
            valor={valores.sobra}
            className="mt-1 block text-3xl font-semibold tracking-[-0.03em] text-[var(--app-text)] md:text-4xl"
          />
        </div>
        <span
          aria-hidden="true"
          className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-[var(--app-element)]"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth={1.9}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="desfazer-glifo h-5 w-5 stroke-[var(--app-tint)]"
          >
            <path d="M4 5v5h5" />
            <path d="M5.2 14.5A7.5 7.5 0 1 0 6.4 7L4 10" />
          </svg>
        </span>
      </div>

      <ul className="mt-6 flex flex-col gap-2.5">
        <li className="desfazer-linha relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl border border-dashed border-white/[0.14] px-4 py-3 opacity-60">
          <span
            aria-hidden="true"
            className="desfazer-fundo absolute inset-0 bg-[var(--app-surface)] opacity-0"
          />
          <div className="relative min-w-0">
            <p className="relative inline-block text-sm font-medium text-[var(--app-text)]">
              Mercado
              <span
                aria-hidden="true"
                className="desfazer-risco absolute inset-x-0 top-1/2 block h-px origin-left bg-[var(--app-text)]"
              />
            </p>
            <p className="truncate text-xs text-[var(--app-text-muted)]">
              Alimentação, entendido como gasto de hoje
            </p>
          </div>
          <div className="relative flex shrink-0 items-center gap-2">
            <span className="desfazer-marca rounded-full bg-[var(--app-tint)]/15 px-2 py-0.5 text-[11px] font-semibold text-[var(--app-tint)]">
              desfeito
            </span>
            <Dinheiro className="text-sm font-semibold text-[var(--app-text)]">
              R$ 45,00
            </Dinheiro>
          </div>
        </li>
        {ANTERIORES.map((item) => (
          <li key={item.titulo} className="desfazer-anterior">
            <Superficie className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--app-text)]">
                  {item.titulo}
                </p>
                <p className="truncate text-xs text-[var(--app-text-muted)]">
                  {item.meta}
                </p>
              </div>
              <Dinheiro className="shrink-0 text-sm font-semibold text-[var(--app-text)]">
                {item.valor}
              </Dinheiro>
            </Superficie>
          </li>
        ))}
      </ul>
    </div>
  );
}
