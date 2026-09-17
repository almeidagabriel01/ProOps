"use client";

import React from "react";

import { cn } from "@/lib/utils";

interface BarraDeTempoProps {
  /** Segundos até `aoTerminar`. */
  duracao: number;
  /** A barra enche. Falso: ela fica parada onde estiver. */
  correndo: boolean;
  aoTerminar: () => void;
  className?: string;
}

/**
 * O relógio do revezamento, visível.
 *
 * É a própria animação CSS que decide quando trocar (`animationend`), então a
 * barra e a troca nunca se desencontram. Pausar é `animation-play-state`, que
 * retoma do ponto em que parou. Para recomeçar do zero, quem usa troca a `key`.
 *
 * `revezamento-enche` está na lista de `prefers-reduced-motion` do
 * `globals.css`: sem animação não há `animationend`, e com isso nada troca
 * sozinho para quem pediu menos movimento. Isso é o comportamento desejado,
 * não um efeito colateral.
 */
export function BarraDeTempo({
  duracao,
  correndo,
  aoTerminar,
  className,
}: BarraDeTempoProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block h-px overflow-hidden bg-[var(--app-text)]/[0.08]",
        className,
      )}
    >
      <span
        onAnimationEnd={aoTerminar}
        style={{
          animationDuration: `${duracao}s`,
          animationPlayState: correndo ? "running" : "paused",
        }}
        className="revezamento-enche block h-full origin-left bg-[var(--app-tint)]"
      />
    </span>
  );
}
