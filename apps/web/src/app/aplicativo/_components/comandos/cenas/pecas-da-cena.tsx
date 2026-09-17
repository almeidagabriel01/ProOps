"use client";

import React from "react";
import NumberFlow from "@number-flow/react";

import { cn } from "@/lib/utils";

/** Mesma curva em toda troca de número da seção, para os dígitos falarem igual. */
const CURVA = "cubic-bezier(0.16, 1, 0.3, 1)";

const REAIS = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/**
 * Um valor em reais que troca dígito a dígito.
 *
 * NumberFlow e não um contador interpolado: um contador passa por todos os
 * valores intermediários ("R$ 4.337", "R$ 4.338"...), o que lê como máquina
 * caça-níquel. Aqui cada dígito gira só o que precisa, como o saldo de um app
 * de banco depois de uma operação.
 *
 * A animação é `aria-hidden`, e o valor vai para o leitor de tela num texto à
 * parte. Sem isso a árvore de acessibilidade recebia um nó por dígito, e o
 * valor era lido "R$ 1 . 2 8 4 , 9 0".
 *
 * Mono e tabular, como `Dinheiro` nas réplicas: é a tipografia de valor do
 * próprio aplicativo.
 */
export function Moeda({
  valor,
  className,
  duracao = 900,
}: {
  valor: number;
  className?: string;
  duracao?: number;
}) {
  const tempo = { duration: duracao, easing: CURVA };
  return (
    <span
      className={cn(
        "[font-family:var(--font-jetbrains-mono)] [font-variant-numeric:tabular-nums]",
        className,
      )}
    >
      <span className="sr-only">{REAIS.format(valor)}</span>
      <NumberFlow
        aria-hidden="true"
        value={valor}
        locales="pt-BR"
        format={{ style: "currency", currency: "BRL" }}
        transformTiming={tempo}
        spinTiming={tempo}
      />
    </span>
  );
}

/**
 * Os números de uma cena: começam no valor FINAL (o que o servidor manda) e a
 * timeline os recalcula a partir do tempo dela, a cada quadro da rolagem.
 *
 * Por isso `definir` devolve o MESMO objeto quando nada mudou: o React
 * descarta a atualização, e rolar não re-renderiza a cena. Só a travessia de um
 * limiar custa um render.
 */
export function useValores<T extends Record<string, number>>(finais: T) {
  const [valores, setValores] = React.useState<T>(finais);
  const definir = React.useCallback(
    (parcial: Partial<T>) =>
      setValores((atual) => {
        const mudou = (Object.keys(parcial) as (keyof T)[]).some(
          (chave) => parcial[chave] !== atual[chave],
        );
        return mudou ? { ...atual, ...parcial } : atual;
      }),
    [],
  );
  return [valores, definir] as const;
}

export function Rotulo({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("text-[13px] text-[var(--app-text-muted)]", className)}>
      {children}
    </p>
  );
}

/** Uma superfície da cena: o cartão do aplicativo em escala de página. */
export function Superficie({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--app-card-border)] bg-[var(--app-surface)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Um check que se desenha. `pathLength` 1 deixa a timeline animar de 1 a 0. */
export function Check({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("h-5 w-5 shrink-0", className)}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        className="cena-check-anel fill-[var(--app-tint)]/15 stroke-[var(--app-tint)]/50"
        strokeWidth={1.2}
      />
      <path
        d="M7.5 12.4l3 3 6-6.4"
        pathLength={1}
        strokeDasharray="1"
        strokeDashoffset="0"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="cena-check-traco stroke-[var(--app-tint)]"
      />
    </svg>
  );
}
