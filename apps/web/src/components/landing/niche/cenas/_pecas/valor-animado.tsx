"use client";

import React from "react";
import NumberFlow from "@number-flow/react";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/format";

const CURVA = "cubic-bezier(0.16, 1, 0.3, 1)";

/** `true` só depois de hidratar (o mesmo cuidado do `Moeda` do /aplicativo). */
function useMontado(): boolean {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/**
 * Um valor em reais que troca dígito a dígito quando a medida muda.
 *
 * O NumberFlow é um elemento customizado que sai vazio do servidor, então o
 * servidor manda o número escrito e a troca pelo animado acontece depois de
 * hidratar, sem o React comparar os dois. A animação é `aria-hidden`; o valor
 * vai ao leitor de tela num texto à parte, anunciado quando muda.
 */
export function ValorAnimado({ valor, className }: { valor: number; className?: string }) {
  const montado = useMontado();
  const texto = formatCurrency(valor);
  return (
    <span className={cn("tabular-nums", className)}>
      <span className="sr-only" aria-live="polite">
        {texto}
      </span>
      {montado ? (
        <NumberFlow
          aria-hidden="true"
          value={valor}
          locales="pt-BR"
          format={{ style: "currency", currency: "BRL" }}
          transformTiming={{ duration: 650, easing: CURVA }}
          spinTiming={{ duration: 650, easing: CURVA }}
        />
      ) : (
        <span aria-hidden="true">{texto}</span>
      )}
    </span>
  );
}
