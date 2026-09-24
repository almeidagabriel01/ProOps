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
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Nicho do exemplo">
        {NICHOS.map((nicho) => (
          <button
            key={nicho.id}
            type="button"
            aria-pressed={ativo === nicho.id}
            onClick={() => escolhe(nicho.id)}
            className={cn(
              "cursor-pointer rounded-full border px-3 py-1.5 text-xs transition-colors duration-300 md:text-[13px]",
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
