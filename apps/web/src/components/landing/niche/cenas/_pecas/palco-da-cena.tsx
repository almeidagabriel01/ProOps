"use client";

import React, { useEffect, useRef } from "react";

import { PauseOffscreen } from "@/components/marketing/_shared/pause-offscreen";

import { ValorAnimado } from "./valor-animado";

interface PalcoDaCenaProps {
  /** O desenho técnico, em SVG. */
  desenho: React.ReactNode;
  /** Os controles: modo de preço, medidas, sistemas. */
  controles: React.ReactNode;
  /** As linhas da proposta que a cena monta. */
  proposta: React.ReactNode;
  total: number;
  /** Uma linha abaixo do total: a fórmula, a recorrência. */
  rodape?: React.ReactNode;
}

/**
 * O esqueleto comum às cinco cenas: o desenho grande à esquerda, e à direita
 * os controles, a proposta que eles montam e o total. Marca `data-visto` na
 * primeira vez que a cena entra na tela, que é o que toca as cotas e as peças
 * (`.cena-nicho[data-visto]` no CSS), e pausa os loops fora da tela.
 */
export function PalcoDaCena({ desenho, controles, proposta, total, rodape }: PalcoDaCenaProps) {
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          el.setAttribute("data-visto", "");
          observador.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  return (
    <div ref={raiz} className="cena-nicho">
      <PauseOffscreen className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-14">
        <figure className="relative text-black dark:text-white" aria-hidden="true">
          {desenho}
        </figure>
        <div className="flex flex-col gap-6">
          {controles}
          <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.3)] dark:border-white/12 dark:bg-neutral-900 dark:shadow-[0_30px_70px_-30px_rgba(0,0,0,0.8)]">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-black/45 dark:text-white/45">
              Proposta
            </p>
            {proposta}
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-[13px] text-black/55 dark:text-white/55">Total</span>
              <ValorAnimado valor={total} className="[font-family:var(--font-pdf-montserrat)] text-3xl font-bold tracking-[-0.02em] text-black dark:text-white" />
            </div>
            {rodape ? <div className="mt-2 text-[12.5px] leading-relaxed text-black/55 dark:text-white/55">{rodape}</div> : null}
          </div>
          <p className="text-[12px] text-black/40 dark:text-white/40">Preços e medidas de exemplo.</p>
        </div>
      </PauseOffscreen>
    </div>
  );
}

