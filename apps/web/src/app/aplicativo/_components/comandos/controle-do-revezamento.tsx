"use client";

import React from "react";

import { cn } from "@/lib/utils";

import { BarraDeTempo } from "./barra-de-tempo";

interface ControleDoRevezamentoProps {
  /** Muda a cada troca, para a barra recomeçar. */
  volta: number;
  duracao: number;
  /** O relógio pode andar (automático e sem pausa). */
  rodando: boolean;
  /** A região está na tela. Fora dela o relógio para sem mudar o botão. */
  emVista: boolean;
  aoTerminar: () => void;
  aoAlternar: () => void;
  /** Do que o botão fala, para o nome acessível: "os pedidos", "as operações". */
  assunto: string;
  className?: string;
}

/**
 * A barra de tempo e o botão que a controla, juntos.
 *
 * Todo conteúdo que troca sozinho por mais de cinco segundos precisa de um
 * jeito de parar (WCAG 2.2.2). O botão é texto e ícone, não só ícone, porque
 * "pausar" num canto de seção não é uma convenção que as pessoas reconheçam.
 */
export function ControleDoRevezamento({
  volta,
  duracao,
  rodando,
  emVista,
  aoTerminar,
  aoAlternar,
  assunto,
  className,
}: ControleDoRevezamentoProps) {
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <BarraDeTempo
        key={volta}
        duracao={duracao}
        correndo={rodando && emVista}
        aoTerminar={aoTerminar}
        className="flex-1"
      />
      <button
        type="button"
        onClick={aoAlternar}
        aria-label={rodando ? `Pausar ${assunto}` : `Passar ${assunto} sozinho`}
        className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-[var(--app-text-muted)] transition-[color,border-color,transform] duration-150 hover:border-white/20 active:scale-[0.97] hover:text-[var(--app-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-tint)]/60"
      >
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className="h-3 w-3 fill-current"
        >
          {rodando ? (
            <path d="M4 2.5h2.6v11H4zM9.4 2.5H12v11H9.4z" />
          ) : (
            <path d="M4.5 2.4l9 5.6-9 5.6z" />
          )}
        </svg>
        {rodando ? "Pausar" : "Reproduzir"}
      </button>
    </div>
  );
}
