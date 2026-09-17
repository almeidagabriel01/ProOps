"use client";

import React from "react";

import { cn } from "@/lib/utils";

import type { Intencao, Pedido } from "../../_content/comandos";
import { Moeda } from "./cenas/pecas-da-cena";

/** O que aconteceu com o pedido, dito do jeito que o aplicativo diz. */
const DESFECHO: Record<Intencao, string> = {
  Despesa: "Lançada",
  Receita: "Lançada",
  Lembrete: "Agendado",
  Pergunta: "Respondida",
  Simulação: "Nada foi lançado",
  Parcelamento: "10 lançamentos criados",
  Transferência: "Lançada",
  Anotação: "Salva",
  Pagamento: "Fatura baixada",
  "Depósito na meta": "Depositado",
  Regra: "Salva",
  Desfazer: "Desfeito",
};

/** Traços de 24×24, no peso dos ícones do aplicativo. */
const TRACO: Record<Intencao, string> = {
  Despesa: "M7 7l10 10M17 9v8H9",
  Receita: "M17 17L7 7M7 15V7h8",
  Lembrete: "M6 16V11a6 6 0 1112 0v5l1.5 2h-15L6 16zM10 20.5a2.2 2.2 0 004 0",
  Pergunta: "M9.2 9.3a2.9 2.9 0 115 2c-1 .8-2.2 1.4-2.2 3M12 18h.01",
  Simulação: "M4 17c4 0 5-5 8-5h8M12 12c3 0 4-5 8-5",
  Parcelamento: "M4 7h16M4 12h16M4 17h10",
  Transferência: "M4 9h14l-3-3M20 15H6l3 3",
  Anotação: "M5 19l1-4L16 5l3 3L9 18l-4 1z",
  Pagamento: "M5 12.5l4.5 4.5L19 7.5",
  "Depósito na meta": "M12 3v12m0 0l-4-4m4 4l4-4M5 20h14",
  Regra: "M13 3L5 13h6l-1 8 8-10h-6l1-8z",
  Desfazer: "M8 7L4 11l4 4M4 11h10a5 5 0 010 10h-2",
};

interface FichaDaLeituraProps {
  pedido: Pedido;
  /** Valor exibido na resposta. A leitura o zera e o devolve, para o NumberFlow correr. */
  numero?: number;
}

/**
 * O que o agente entendeu, no formato de um objeto do aplicativo.
 *
 * Cada campo que veio da frase carrega `data-alvo` com a entidade de origem: é
 * o ponto de pouso do token que voa da frase até aqui. Os campos sem entidade
 * são os que o agente DEDUZIU (a conta padrão, a data de hoje), e dizem isso
 * com todas as letras. É essa distinção que torna a ficha uma prova e não uma
 * ilustração: o leitor vê o que estava escrito e o que foi inferido.
 */
export function FichaDaLeitura({ pedido, numero }: FichaDaLeituraProps) {
  const { resposta } = pedido;

  return (
    <div className="ficha relative overflow-hidden rounded-[1.75rem] border border-[var(--app-card-border)] bg-[linear-gradient(180deg,var(--app-hero-top),var(--app-hero-bottom))] p-5 shadow-[0_40px_80px_-48px_rgba(0,0,0,0.9)] md:p-7">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-[var(--app-tint)] opacity-[0.12] blur-[60px]"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)]"
      />

      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <span className="ficha-selo inline-flex items-center gap-2 rounded-full bg-[var(--app-tint)]/[0.13] py-1.5 pl-2 pr-3.5 text-sm font-semibold text-[var(--app-tint)]">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--app-tint)]/15">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-3.5 w-3.5 stroke-current"
            >
              <path d={TRACO[pedido.intencao]} />
            </svg>
          </span>
          {pedido.intencao}
        </span>
        <span className="ficha-desfecho text-[13px] text-[var(--app-on-hero-muted)]">
          {DESFECHO[pedido.intencao]}
        </span>
      </div>

      {resposta ? (
        <div className="ficha-resposta relative mt-6">
          <p className="text-sm text-[var(--app-on-hero-muted)]">
            {resposta.rotulo}
          </p>
          <p
            className={cn(
              "mt-1 [font-family:var(--font-jetbrains-mono)] text-[2rem] font-semibold leading-tight tracking-[-0.03em] md:text-[2.5rem]",
              resposta.valor.tipo === "moeda" && resposta.valor.numero < 0
                ? "text-[var(--app-danger)]"
                : "text-[var(--app-text)]",
            )}
          >
            {resposta.valor.tipo === "moeda" ? (
              <Moeda valor={numero ?? resposta.valor.numero} />
            ) : (
              resposta.valor.texto
            )}
          </p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--app-on-hero-muted)]">
            {resposta.nota}
          </p>
        </div>
      ) : null}

      <dl className="relative mt-5 divide-y divide-white/[0.06] border-t border-white/[0.06]">
        {pedido.campos.map((campo) => (
          <div
            key={campo.rotulo}
            className="ficha-campo flex items-baseline justify-between gap-4 py-3"
          >
            <dt className="shrink-0 text-sm text-[var(--app-on-hero-muted)]">
              {campo.rotulo}
            </dt>
            <dd className="flex min-w-0 items-baseline justify-end gap-2 text-right">
              {campo.entidade ? null : (
                <span className="ficha-deduzido shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-[var(--app-on-hero-muted)]">
                  deduzido
                </span>
              )}
              <span
                data-alvo={campo.entidade}
                className="ficha-valor inline-block text-[15px] font-medium text-[var(--app-text)] [font-variant-numeric:tabular-nums]"
              >
                {campo.valor}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
