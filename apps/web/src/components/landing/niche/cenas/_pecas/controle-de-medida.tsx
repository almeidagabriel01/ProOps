"use client";

import React, { useId } from "react";

interface ControleDeMedidaProps {
  rotulo: string;
  valor: number;
  min: number;
  max: number;
  passo?: number;
  /** "m" para metros, "un" para unidades. */
  unidade: "m" | "un";
  onChange: (valor: number) => void;
}

function formatar(valor: number, unidade: "m" | "un"): string {
  if (unidade === "un") return `${valor} un`;
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;
}

/**
 * Uma medida que a pessoa arrasta. É um `<input type="range">` nativo, com o
 * visual em `.controle-medida` (`app/vitrine.css`): teclado, leitor de tela e
 * toque funcionam como em qualquer controle do sistema.
 */
export function ControleDeMedida({ rotulo, valor, min, max, passo = 0.05, unidade, onChange }: ControleDeMedidaProps) {
  const id = useId();
  const pct = ((valor - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-[13px] font-medium text-black/60 dark:text-white/60">
          {rotulo}
        </label>
        <output htmlFor={id} className="text-[15px] font-semibold tabular-nums text-black dark:text-white">
          {formatar(valor, unidade)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={passo}
        value={valor}
        aria-valuetext={formatar(valor, unidade)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="controle-medida mt-1 text-black dark:text-white"
        style={{ "--pct": `${pct}%` } as React.CSSProperties}
      />
    </div>
  );
}
