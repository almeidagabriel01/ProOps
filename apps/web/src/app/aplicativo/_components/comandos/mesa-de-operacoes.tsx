"use client";

import React from "react";

import { useReducedMotion } from "@/components/landing/_shared/use-reduced-motion";
import { scrollToOffset } from "@/lib/landing/smooth-scroll";
import { cn } from "@/lib/utils";

import { OPERACOES } from "../../_content/comandos";
import { CENAS } from "./cenas";
import { ControleDoRevezamento } from "./controle-do-revezamento";
import { TrocaComSaida } from "./troca-com-saida";
import { useRevezamento } from "./use-revezamento";
import { useVisibilidade } from "./use-visibilidade";

/** A cena mais longa leva ~3,6s; o resto é para o resultado ser lido. */
const DURACAO = 7;
/** Altura da barra fixa, mais um respiro. */
const FOLGA_DO_TOPO = 96;

/**
 * A segunda metade da seção: as operações que a categoria não faz, cada uma
 * com o próprio diagrama.
 *
 * Abas de verdade (`tablist`), com a navegação por setas do padrão ARIA e
 * foco que acompanha a seleção. A lista fica à esquerda e o palco à direita,
 * como a lista de comandos e o resultado de um Raycast; no celular o palco
 * sobe e a lista fica embaixo dele, que é onde o polegar está.
 *
 * Só a cena ativa existe no DOM. As seis montadas ao mesmo tempo seriam seis
 * árvores com NumberFlow, SVG e timeline para uma ficar visível.
 */
export function MesaDeOperacoes() {
  const { ref, armado, emVista } = useVisibilidade<HTMLDivElement>();
  const reduzido = useReducedMotion();
  const revezamento = useRevezamento(OPERACOES.length);
  const idBase = React.useId();
  const abas = React.useRef<(HTMLButtonElement | null)[]>([]);
  const palco = React.useRef<HTMLDivElement>(null);

  /**
   * No celular a lista fica ABAIXO do palco, e com seis abas o palco já saiu
   * da tela quando o polegar chega na última. Trocar uma cena que ninguém vê
   * é um toque sem resposta: aqui o palco volta para a vista junto com a troca.
   */
  function escolherPorToque(indice: number) {
    revezamento.escolher(indice);
    const el = palco.current;
    if (!el || window.matchMedia("(min-width: 768px)").matches) return;
    const topo = el.getBoundingClientRect().top;
    if (topo >= FOLGA_DO_TOPO) return;
    scrollToOffset(window.scrollY + topo - FOLGA_DO_TOPO);
  }
  const operacao = OPERACOES[revezamento.indice];

  function aoTeclar(evento: React.KeyboardEvent<HTMLDivElement>) {
    const total = OPERACOES.length;
    const atual = revezamento.indice;
    const destinos: Record<string, number> = {
      ArrowDown: (atual + 1) % total,
      ArrowRight: (atual + 1) % total,
      ArrowUp: (atual - 1 + total) % total,
      ArrowLeft: (atual - 1 + total) % total,
      Home: 0,
      End: total - 1,
    };
    if (!(evento.key in destinos)) return;
    evento.preventDefault();
    const destino = destinos[evento.key];
    revezamento.escolher(destino);
    abas.current[destino]?.focus();
  }

  return (
    <div
      ref={ref}
      className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] md:gap-10 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:gap-14"
    >
      <div className="order-2 md:order-1">
        <div
          role="tablist"
          aria-label="Operações de exemplo"
          aria-orientation="vertical"
          onKeyDown={aoTeclar}
          className="flex flex-col"
        >
          {OPERACOES.map((item, i) => {
            const ativa = i === revezamento.indice;
            return (
              <button
                key={item.cena}
                ref={(el) => {
                  abas.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`${idBase}-aba-${i}`}
                aria-selected={ativa}
                aria-controls={`${idBase}-painel`}
                tabIndex={ativa ? 0 : -1}
                onClick={() => escolherPorToque(i)}
                className={cn(
                  "group relative flex items-center gap-3 border-b border-white/[0.06] py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--app-tint)]/60",
                  ativa
                    ? "text-[var(--app-text)]"
                    : "text-[var(--app-text-muted)] hover:text-[var(--app-text)]",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full transition-[transform,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                    ativa
                      ? "scale-100 bg-[var(--app-tint)]"
                      : "scale-50 bg-[var(--app-text-muted)]/50",
                  )}
                />
                <span className="text-[15px] leading-snug md:text-base">
                  {item.pedido}
                </span>
              </button>
            );
          })}
        </div>

        {reduzido ? null : (
          <ControleDoRevezamento
            volta={revezamento.volta}
            duracao={DURACAO}
            rodando={revezamento.rodando}
            emVista={emVista}
            aoTerminar={revezamento.avancar}
            aoAlternar={revezamento.alternar}
            assunto="as operações"
            className="mt-5"
          />
        )}
      </div>

      <div
        ref={palco}
        role="tabpanel"
        id={`${idBase}-painel`}
        aria-labelledby={`${idBase}-aba-${revezamento.indice}`}
        className="order-1 md:order-2"
      >
        <div className="relative overflow-hidden rounded-[2rem] border border-[var(--app-card-border)] bg-[linear-gradient(180deg,var(--app-hero-top),var(--app-bg))] p-5 shadow-[0_50px_100px_-60px_rgba(0,0,0,0.95)] md:p-8">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-32 h-72 w-72 rounded-full bg-[var(--app-tint)] opacity-[0.08] blur-[80px]"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)]"
          />

          <p className="relative [font-family:var(--font-jetbrains-mono)] text-sm text-[var(--app-tint)]">
            {operacao.pedido}
          </p>

          <div className="relative mt-6 min-h-[22rem] md:mt-8 md:h-[24rem]">
            <TrocaComSaida
              valor={operacao}
              chave={(o) => o.cena}
              className="h-full"
            >
              {(exibida) => {
                const Cena = CENAS[exibida.cena];
                return <Cena armado={armado} tocando={emVista} />;
              }}
            </TrocaComSaida>
          </div>
        </div>

        <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--app-text-muted)]">
          {operacao.efeito}
        </p>
      </div>
    </div>
  );
}
