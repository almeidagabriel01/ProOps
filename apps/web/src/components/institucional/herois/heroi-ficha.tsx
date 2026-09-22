import React from "react";

import { cn } from "@/lib/utils";

export interface DadoDoHero {
  /** Dois ou três caracteres. O número é o ponto. */
  valor: string;
  /** Curto: fica AO LADO do número, na mesma base, e não embaixo dele. */
  rotulo: string;
}

/**
 * A ficha do herói: no máximo três fatos, numa linha só, sobre um filete, no
 * lugar onde um cartão de título de filme põe os créditos.
 *
 * Ela começou como uma grade de células com borda, e duas células numa tela
 * cheia são dois cartões vazios com um número dentro.
 *
 * Fica NO FLUXO, empurrada para o rodapé pelo `mt-auto`, e não mais posicionada
 * por baixo com um `pb` grande reservando o espaço dela. Com uma cena de verdade
 * no herói, a altura do conteúdo deixou de ser previsível, e uma ficha fora do
 * fluxo passava a encostar na cena no celular. No fluxo, ela simplesmente vem
 * depois.
 */
export function HeroiFicha({
  dados,
  centrada = false,
  atraso = 0.6,
}: {
  dados: DadoDoHero[];
  centrada?: boolean;
  atraso?: number;
}) {
  return (
    <div className="relative z-10 mx-auto mt-auto w-full max-w-6xl pt-14 md:pt-16">
      <dl
        className={cn(
          "hero-enter flex flex-wrap items-baseline gap-x-12 gap-y-4 border-t border-white/12 pt-5",
          centrada && "justify-center",
        )}
        style={
          {
            "--hero-y": "12px",
            "--hero-delay": `${atraso}s`,
          } as React.CSSProperties
        }
      >
        {dados.map((dado) => (
          <div key={dado.rotulo} className="flex items-baseline gap-2.5">
            {/* O rótulo vem primeiro no DOM porque é isso que um `dl` quer, e
                depois do número na tela porque é assim que se lê uma ficha: o
                valor puxa o olho, a palavra explica. */}
            <dt className="order-2 max-w-[20ch] text-sm leading-snug text-white/50">
              {dado.rotulo}
            </dt>
            <dd className="order-1 [font-family:var(--font-bricolage)] text-2xl font-extrabold leading-none tracking-[-0.04em] text-white tabular-nums md:text-[1.75rem]">
              {dado.valor}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
