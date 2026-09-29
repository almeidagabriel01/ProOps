"use client";

import React, { useRef } from "react";

import { cn } from "@/lib/utils";

interface SeletorDeModoProps<T extends string> {
  rotulo: string;
  opcoes: readonly { id: T; rotulo: string }[];
  valor: T;
  onChange: (valor: T) => void;
}

/**
 * Um grupo de opções exclusivas, com a pílula que desliza até a escolhida.
 * A pílula é um elemento só, movido por `transform` (a largura de cada opção
 * é igual, então o deslocamento é o índice em porcentagem), e as setas do
 * teclado trocam a opção como num grupo de rádio.
 */
export function SeletorDeModo<T extends string>({ rotulo, opcoes, valor, onChange }: SeletorDeModoProps<T>) {
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);
  const indice = Math.max(0, opcoes.findIndex((o) => o.id === valor));

  const teclado = (event: React.KeyboardEvent) => {
    const passo = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!passo) return;
    event.preventDefault();
    const proximo = (indice + passo + opcoes.length) % opcoes.length;
    onChange(opcoes[proximo].id);
    botoes.current[proximo]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={rotulo}
      onKeyDown={teclado}
      className="relative grid rounded-full border border-black/12 p-1 dark:border-white/15"
      style={{ gridTemplateColumns: `repeat(${opcoes.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="absolute bottom-1 left-1 top-1 rounded-full bg-black transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none dark:bg-white"
        style={{
          width: `calc((100% - 0.5rem) / ${opcoes.length})`,
          transform: `translateX(${indice * 100}%)`,
        }}
      />
      {opcoes.map((opcao, i) => {
        const ativo = i === indice;
        return (
          <button
            key={opcao.id}
            ref={(el) => {
              botoes.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={ativo}
            tabIndex={ativo ? 0 : -1}
            onClick={() => onChange(opcao.id)}
            className={cn(
              "relative z-10 rounded-full px-2 py-2 text-[12.5px] font-semibold leading-tight transition-colors duration-200 sm:text-[13px]",
              ativo ? "text-white dark:text-black" : "text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white",
            )}
          >
            {opcao.rotulo}
          </button>
        );
      })}
    </div>
  );
}
