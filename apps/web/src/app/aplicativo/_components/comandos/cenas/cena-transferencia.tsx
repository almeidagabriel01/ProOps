"use client";

import React from "react";
import gsap from "gsap";
import { DrawSVGPlugin } from "gsap/dist/DrawSVGPlugin";
import { MotionPathPlugin } from "gsap/dist/MotionPathPlugin";

import { Dinheiro } from "../../telas/pecas";
import { useCena } from "../use-cena";
import { Moeda, Rotulo, Superficie, useValores } from "./pecas-da-cena";
import type { PropsDaCena } from "./tipos";

if (typeof window !== "undefined") {
  gsap.registerPlugin(MotionPathPlugin, DrawSVGPlugin);
}

const CONTA = { antes: 3870, depois: 3370 };
const FATURA = { antes: 1590, depois: 1090 };

/**
 * "transfere 500 da conta pro cartão".
 *
 * O erro que a cena existe para mostrar evitado é o de toda planilha: a
 * transferência lançada como gasto, estragando o mês. Por isso ela tem três
 * partes, na ordem em que o olho as lê:
 *
 * 1. o dinheiro sai de um lado e chega no outro, por um arco, e os dois saldos
 *    mudam no instante em que o pulso passa;
 * 2. o registro é UM lançamento só, com as duas pontas;
 * 3. o gasto novo do mês continua em zero, e é o único número da cena que não
 *    se mexe. Parado de propósito.
 *
 * O pulso anda pelo próprio `<path>` com `MotionPathPlugin`, que resolve a
 * escala do `viewBox`: o arco estica com a largura e o pulso continua em cima
 * dele, sem nenhuma conta no componente.
 *
 * O arco é desenhado com `DrawSVGPlugin` e não com `pathLength` +
 * `stroke-dashoffset`: com `vector-effect: non-scaling-stroke` (que mantém o
 * traço fino num SVG esticado) o Chrome calcula o tracejado em outra escala, e
 * o arco aparecia partido ao meio mesmo no estado final.
 */
export function CenaTransferencia({ armado, progresso }: PropsDaCena) {
  const raiz = React.useRef<HTMLDivElement>(null);
  const [valores, definir] = useValores({
    conta: CONTA.depois,
    fatura: FATURA.depois,
  });

  useCena(
    raiz,
    (tl, { acompanhar }) => {
      const q = gsap.utils.selector(raiz);
      const arco = q<SVGPathElement>(".transferencia-arco")[0];
      const pulso = q<HTMLElement>(".transferencia-pulso")[0];
      if (!arco || !pulso) return;

      tl.fromTo(
        q(".transferencia-ponta"),
        { autoAlpha: 0, y: 14 },
        { autoAlpha: 1, y: 0, duration: 0.6, ease: "expo.out", stagger: 0.12 },
        0.05,
      )
        .fromTo(
          arco,
          { drawSVG: "0%" },
          { drawSVG: "100%", duration: 0.8, ease: "power2.inOut" },
          0.5,
        )
        .fromTo(pulso, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15 }, 1.25)
        .fromTo(
          pulso,
          {
            motionPath: {
              path: arco,
              align: arco,
              alignOrigin: [0.5, 0.5],
              start: 0,
              end: 0,
            },
          },
          {
            motionPath: {
              path: arco,
              align: arco,
              alignOrigin: [0.5, 0.5],
              start: 0,
              end: 1,
            },
            duration: 1.1,
            ease: "power2.inOut",
          },
          1.25,
        )
        .to(
          pulso,
          { autoAlpha: 0, scale: 2.4, duration: 0.45, ease: "power2.out" },
          2.35,
        )
        .fromTo(
          q(".transferencia-chegada"),
          { autoAlpha: 0.9, scale: 1 },
          { autoAlpha: 0, scale: 1.08, duration: 0.8, ease: "power2.out" },
          2.3,
        )
        .fromTo(
          q(".transferencia-registro"),
          { autoAlpha: 0, y: 16, scale: 0.98 },
          { autoAlpha: 1, y: 0, scale: 1, duration: 0.7, ease: "expo.out" },
          2.6,
        )
        .fromTo(
          q(".transferencia-zero"),
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.6 },
          3.1,
        );

      acompanhar((tempo) =>
        definir({
          conta: tempo >= 1.3 ? CONTA.depois : CONTA.antes,
          fatura: tempo >= 2.2 ? FATURA.depois : FATURA.antes,
        }),
      );

      return () => definir({ conta: CONTA.depois, fatura: FATURA.depois });
    },
    { armado, progresso },
  );

  return (
    <div ref={raiz} className="flex h-full flex-col justify-center gap-5">
      <div className="relative">
        <svg
          viewBox="0 0 100 30"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-[18%] -top-9 h-12 w-[64%] overflow-visible md:-top-12 md:h-16"
        >
          <path
            className="transferencia-arco"
            d="M0 30 C 20 -6, 80 -6, 100 30"
            fill="none"
            stroke="var(--app-tint)"
            strokeOpacity={0.55}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span
          aria-hidden="true"
          className="transferencia-pulso pointer-events-none absolute left-0 top-0 z-10 h-3 w-3 rounded-full bg-[var(--app-tint)] opacity-0 shadow-[0_0_0_6px_rgba(109,220,158,0.18),0_0_24px_rgba(109,220,158,0.7)]"
        />

        <div className="mt-10 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 md:mt-14 md:gap-6">
          <Superficie className="transferencia-ponta p-4 md:p-5">
            <Rotulo>Conta principal</Rotulo>
            <Moeda
              valor={valores.conta}
              className="mt-1 block text-base font-semibold text-[var(--app-text)] sm:text-lg md:text-2xl"
            />
            <p className="mt-1 text-xs text-[var(--app-text-muted)]">saldo</p>
          </Superficie>
          <Superficie className="transferencia-ponta relative p-4 md:p-5">
            <span
              aria-hidden="true"
              className="transferencia-chegada pointer-events-none absolute -inset-px rounded-2xl border border-[var(--app-tint)] opacity-0"
            />
            <Rotulo>Cartão da casa</Rotulo>
            <Moeda
              valor={valores.fatura}
              className="mt-1 block text-base font-semibold text-[var(--app-text)] sm:text-lg md:text-2xl"
            />
            <p className="mt-1 text-xs text-[var(--app-text-muted)]">fatura</p>
          </Superficie>
        </div>
      </div>

      <Superficie className="transferencia-registro flex items-center gap-3 px-4 py-3">
        <span
          aria-hidden="true"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--app-tint)]/15"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 stroke-[var(--app-tint)]"
          >
            <path d="M4 9h14l-3-3M20 15H6l3 3" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--app-text)]">
            Transferência
          </p>
          <p className="truncate text-xs text-[var(--app-text-muted)]">
            Da conta principal para o cartão da casa
          </p>
        </div>
        <Dinheiro className="shrink-0 text-sm font-semibold text-[var(--app-text)]">
          R$ 500,00
        </Dinheiro>
      </Superficie>

      <div className="transferencia-zero flex items-baseline justify-between gap-4 border-t border-white/[0.06] pt-4">
        <Rotulo>Gasto novo no mês</Rotulo>
        <Dinheiro className="text-sm font-semibold text-[var(--app-text)]">
          R$ 0,00
        </Dinheiro>
      </div>
    </div>
  );
}
