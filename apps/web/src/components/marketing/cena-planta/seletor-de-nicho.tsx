"use client";

import React, { useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { NICHOS, NICHO_PADRAO, nichoPorId, type NichoDaCena } from "./dados";

/**
 * A troca de nicho da cena.
 *
 * O que ela faz é escrever `data-nicho` na raiz da cena; quem troca os rótulos
 * é o CSS. Nenhum nó é remontado, então dá para trocar de nicho no meio da
 * rolagem e ver a MESMA proposta se reescrever no vocabulário do outro
 * negócio, que é exatamente o argumento da seção.
 *
 * O estado React existe só para o `aria-pressed` e para o estilo do botão: o
 * conteúdo já está todo no HTML do servidor, nos três rótulos de cada item.
 */
export function SeletorDeNicho({ className }: { className?: string }) {
  const [ativo, setAtivo] = useState<NichoDaCena>(NICHO_PADRAO);
  const ancora = useRef<HTMLDivElement>(null);

  const escolhe = (id: NichoDaCena) => {
    setAtivo(id);
    ancora.current?.closest<HTMLElement>("[data-cena-planta]")?.setAttribute("data-nicho", id);
  };

  return (
    <div ref={ancora} data-seletor-de-nicho="" className={cn("pointer-events-auto", className)}>
      {/* No retrato as abas são UMA linha que rola de lado. A faixa de texto de
          cima tem altura reservada (`--faixa-topo`, no globals.css), e abas que
          quebram em linhas empurram a nota para cima da casa: com cinco nichos
          isso já acontecia a 360px com a fonte do Linux. Uma linha só não
          depende da fonte nem de quantos nichos existem. O `pr-10` deixa a
          última aba passar do esmaecido da borda. */}
      <div
        className="-mx-6 flex gap-1.5 overflow-x-auto px-6 pr-10 [mask-image:linear-gradient(to_right,black_85%,transparent)] [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:[mask-image:none] [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label="Nicho do exemplo"
        data-abas-de-nicho=""
      >
        {NICHOS.map((nicho) => (
          <button
            key={nicho.id}
            type="button"
            aria-pressed={ativo === nicho.id}
            onClick={() => escolhe(nicho.id)}
            className={cn(
              "shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition-colors duration-300 md:text-[13px]",
              ativo === nicho.id
                ? "border-[rgb(var(--realce)/0.6)] bg-[rgb(var(--realce)/0.12)] text-white"
                : "border-white/15 text-white/55 hover:border-white/30 hover:text-white/80",
            )}
          >
            {nicho.rotulo}
          </button>
        ))}
      </div>
      <p className="mt-2.5 max-w-sm text-xs leading-relaxed text-white/45">
        {nichoPorId(ativo).nota}
      </p>
    </div>
  );
}
