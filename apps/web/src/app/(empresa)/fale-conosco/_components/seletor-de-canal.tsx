"use client";

import React from "react";
import { m as motion } from "motion/react";

import { cn } from "@/lib/utils";

import type { Canal } from "@/app/(empresa)/institucional/_content/institucional-copy";

/**
 * Pick a reason. The rest of the page answers.
 *
 * Controlado: quem guarda a escolha é `FormularioDaConversa`, porque a mesma
 * escolha decide o texto do painel, o convite do campo de mensagem, o prazo
 * prometido e o `segment` que sai na requisição. Um seletor com estado próprio
 * obrigaria a duplicar esse estado, e duplicar estado de seleção é como uma tela
 * passa a prometer um prazo e enviar outro.
 *
 * Built as a real radio group. Buttons with `aria-pressed` would announce as
 * three independent toggles, and a keyboard user would have to tab through all
 * of them; a radiogroup is one tab stop with arrow keys inside it, which is what
 * a "choose one" control is supposed to be. Roving `tabIndex` is what makes that
 * work, and `onKeyDown` moves the selection so the arrows do something.
 *
 * O indicador de seleção é UM elemento com `layoutId`, e não uma borda por
 * opção: assim ele desliza de um motivo para o outro em vez de piscar no
 * destino, que é o que faz a escolha parecer um movimento e não um estado.
 */
export function SeletorDeCanal({
  canais,
  ativo,
  aoEscolher,
  className,
}: {
  canais: Canal[];
  ativo: number;
  aoEscolher: (indice: number) => void;
  className?: string;
}) {
  const mover = (delta: number) => {
    aoEscolher((ativo + delta + canais.length) % canais.length);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Motivo do contato"
      className={cn("flex flex-col", className)}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowRight") {
          event.preventDefault();
          mover(1);
        }
        if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
          event.preventDefault();
          mover(-1);
        }
      }}
    >
      {canais.map((item, index) => {
        const selecionado = index === ativo;
        return (
          <button
            key={item.motivo}
            type="button"
            role="radio"
            aria-checked={selecionado}
            // Roving tabindex: the group is ONE tab stop, and the arrows move
            // inside it. Without this every option is its own stop, which is
            // exactly the thing a radio group exists to avoid.
            tabIndex={selecionado ? 0 : -1}
            onClick={() => aoEscolher(index)}
            className={cn(
              "group relative flex w-full items-center gap-4 border-t border-white/10 px-1 py-6 text-left transition-colors duration-300 first:border-t-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 md:px-2",
              selecionado ? "text-white" : "text-white/45 hover:text-white/80",
            )}
          >
            {selecionado && (
              <motion.span
                aria-hidden="true"
                layoutId="canal-ativo"
                transition={{ type: "spring", stiffness: 420, damping: 38 }}
                className="absolute inset-y-0 -left-4 w-px bg-white md:-left-6"
              />
            )}

            <span
              aria-hidden="true"
              className="[font-family:var(--font-geist-mono)] text-[11px] tabular-nums tracking-[0.2em] text-white/30"
            >
              {String(index + 1).padStart(2, "0")}
            </span>

            <span className="[font-family:var(--font-bricolage)] text-lg font-semibold tracking-tight md:text-xl">
              {item.motivo}
            </span>

            <span
              aria-hidden="true"
              className={cn(
                "ml-auto inline-block transition-all duration-300",
                selecionado
                  ? "translate-x-0 opacity-100"
                  : "-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-50",
              )}
            >
              &rarr;
            </span>
          </button>
        );
      })}
    </div>
  );
}
