import React from "react";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/format";

interface LinhaDaPropostaProps {
  descricao: string;
  medida: string;
  total: number;
  /** A linha de que a cena está falando agora. */
  ativa?: boolean;
  /** Linha fora da proposta (sistema desligado): some com transição. */
  fora?: boolean;
}

/** Uma linha da proposta como sai no PDF: o item, a medida e o total. */
export function LinhaDaProposta({ descricao, medida, total, ativa, fora }: LinhaDaPropostaProps) {
  return (
    <div
      className={cn(
        "relative grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 border-b border-black/8 py-2.5 pl-3 transition-[opacity,background-color] duration-300 dark:border-white/10",
        ativa && "bg-[var(--acento-suave)]",
        fora && "opacity-30",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute bottom-2 left-0 top-2 w-[3px] rounded-full bg-[var(--acento)] transition-transform duration-300",
          ativa ? "scale-y-100" : "scale-y-0",
        )}
      />
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-medium text-black dark:text-white">{descricao}</span>
        <span className="block text-[12px] tabular-nums text-black/50 dark:text-white/50">{medida}</span>
      </span>
      <span className="text-[14px] font-semibold tabular-nums text-black dark:text-white">{formatCurrency(total)}</span>
    </div>
  );
}
