"use client";

import React from "react";
import gsap from "gsap";

import { cn } from "@/lib/utils";

import { useCena } from "../use-cena";
import { Moeda, Rotulo, Superficie } from "./pecas-da-cena";
import type { PropsDaCena } from "./tipos";

const MESES = [
  "set",
  "out",
  "nov",
  "dez",
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
];

/**
 * "parcela a geladeira de 3.200 em 10x".
 *
 * O valor se reparte em dez fichas, e as fichas são DISTRIBUÍDAS, como cartas,
 * sobre a régua das próximas dez faturas. Cada ficha sai do mesmo ponto (o
 * valor total) com uma rotação própria e assenta reta no seu mês. A primeira
 * cai na fatura que ainda está aberta, que pulsa: é a parte da operação que as
 * pessoas erram quando lançam na mão.
 *
 * As distâncias são medidas uma vez, na montagem, com a cena no estado final.
 * Em celular a régua quebra em duas linhas de cinco, e a mesma conta serve.
 */
export function CenaParcelas({ armado, tocando }: PropsDaCena) {
  const raiz = React.useRef<HTMLDivElement>(null);

  useCena(
    raiz,
    (tl) => {
      const q = gsap.utils.selector(raiz);
      const origem = q<HTMLElement>(".parcelas-origem")[0];
      const fichas = q<HTMLElement>(".parcelas-ficha");
      if (!origem) return;

      const o = origem.getBoundingClientRect();
      const centroX = o.left + o.width / 2;
      const centroY = o.top + o.height / 2;
      const distancias = fichas.map((ficha) => {
        const r = ficha.getBoundingClientRect();
        return {
          x: centroX - (r.left + r.width / 2),
          y: centroY - (r.top + r.height / 2),
        };
      });

      tl.fromTo(
        origem,
        { autoAlpha: 0, y: -16, scale: 0.94 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.7, ease: "expo.out" },
        0.1,
      )
        .fromTo(
          q(".parcelas-mes"),
          { autoAlpha: 0, y: 12 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.5,
            ease: "power3.out",
            stagger: 0.035,
          },
          0.25,
        )
        // `to`, e não `fromTo`: um segundo `fromTo` no mesmo alvo escreveria o
        // próprio estado inicial na montagem, por cima do da entrada.
        .to(
          origem,
          {
            scale: 0.96,
            duration: 0.18,
            ease: "power2.in",
            yoyo: true,
            repeat: 1,
          },
          0.95,
        );

      fichas.forEach((ficha, i) => {
        const { x, y } = distancias[i];
        tl.fromTo(
          ficha,
          {
            x,
            y,
            rotation: (i % 2 === 0 ? -1 : 1) * (10 + i * 2.4),
            scale: 0.6,
            autoAlpha: 0,
          },
          {
            x: 0,
            y: 0,
            rotation: 0,
            scale: 1,
            autoAlpha: 1,
            duration: 0.85,
            ease: "expo.out",
          },
          1.1 + i * 0.085,
        );
      });

      const pouso = 1.1 + 0.55;
      tl.fromTo(
        q(".parcelas-pulso"),
        { autoAlpha: 0.9, scale: 1 },
        {
          autoAlpha: 0,
          scale: 1.35,
          duration: 1.1,
          ease: "power2.out",
          repeat: 1,
        },
        pouso,
      ).fromTo(
        q(".parcelas-legenda"),
        { autoAlpha: 0, y: 8 },
        { autoAlpha: 1, y: 0, duration: 0.6, ease: "power3.out" },
        pouso + 0.6,
      );
    },
    { armado, tocando },
  );

  return (
    <div ref={raiz} className="flex h-full flex-col justify-center">
      <Superficie className="parcelas-origem mx-auto flex items-center gap-4 px-5 py-4">
        <span
          aria-hidden="true"
          className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--app-element)]"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth={1.7}
            className="h-5 w-5 stroke-[var(--app-text)]"
          >
            <rect x="6" y="3" width="12" height="18" rx="2" />
            <path d="M6 10h12M9 6.5v1.5M9 13v3" strokeLinecap="round" />
          </svg>
        </span>
        <div>
          <Rotulo>Geladeira, no cartão da casa</Rotulo>
          <p className="mt-0.5 text-lg font-semibold text-[var(--app-text)]">
            <Moeda valor={3200} />{" "}
            <span className="text-[var(--app-text-muted)]">em 10x</span>
          </p>
        </div>
      </Superficie>

      <ol className="mt-10 grid grid-cols-5 gap-x-2 gap-y-4 md:mt-14 md:grid-cols-10">
        {MESES.map((mes, i) => (
          <li
            key={mes}
            className="parcelas-mes flex flex-col items-center gap-2"
          >
            <div
              className={cn(
                "relative flex h-14 w-full items-center justify-center rounded-xl border border-dashed md:h-20",
                i === 0
                  ? "border-[var(--app-tint)]/60 bg-[var(--app-tint)]/[0.07]"
                  : "border-white/[0.1]",
              )}
            >
              {i === 0 ? (
                <span
                  aria-hidden="true"
                  className="parcelas-pulso absolute -inset-px rounded-xl border border-[var(--app-tint)] opacity-0"
                />
              ) : null}
              <span className="parcelas-ficha rounded-lg bg-[var(--app-raised)] px-1.5 py-1 [font-family:var(--font-jetbrains-mono)] text-[11px] font-semibold text-[var(--app-text)] shadow-[0_8px_18px_-8px_rgba(0,0,0,0.8)] md:text-xs">
                320
              </span>
            </div>
            <span
              className={cn(
                "text-xs",
                i === 0
                  ? "font-semibold text-[var(--app-tint)]"
                  : "text-[var(--app-text-muted)]",
              )}
            >
              {mes}
            </span>
          </li>
        ))}
      </ol>

      <p className="parcelas-legenda mt-6 flex items-center gap-2 text-sm text-[var(--app-text-muted)]">
        <span
          aria-hidden="true"
          className="h-2 w-2 shrink-0 rounded-full bg-[var(--app-tint)]"
        />
        A primeira parcela entra na fatura de setembro, que fecha dia 20.
      </p>
    </div>
  );
}
