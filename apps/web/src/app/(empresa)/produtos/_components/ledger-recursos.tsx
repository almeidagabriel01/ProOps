"use client";

import React, { useRef } from "react";
import { m as motion, useTransform } from "motion/react";

import { useScrollProgress } from "@/components/marketing/_shared/use-scroll-progress";
import { APP_NAME } from "@/lib/site/app-brand";

interface Linha {
  pergunta: string;
  erp: string;
  app: string;
}

/**
 * The same question at both scales, which is the whole argument of the page.
 *
 * Phrased as questions rather than as feature names on purpose: "Integrações
 * via API" tells a reader nothing about whether the product is for them, while
 * "Quanto ainda tenho para receber este mês" is a question they have already
 * asked out loud this week.
 */
const LINHAS: Linha[] = [
  {
    pergunta: "Quanto ainda tenho para receber?",
    erp: "Financeiro por período, com o que foi pago e o que está pendente já separados.",
    app: "Quanto sobra até o fim do mês, contando o que já está comprometido.",
  },
  {
    pergunta: "Onde é que este negócio parou?",
    erp: "Funil de CRM, com a proposta e o histórico do cliente no mesmo lugar.",
    app: "Lembrete pedido por mensagem, que volta na hora certa.",
  },
  {
    pergunta: "Como registro isto agora, sem parar o que estou fazendo?",
    erp: "Lançamento na proposta, que já atualiza o financeiro sem redigitar.",
    app: "Uma frase ou um áudio no WhatsApp, e a IA classifica.",
  },
  {
    pergunta: "Consigo mostrar isto para outra pessoa?",
    erp: "PDF próprio da proposta, entregue na pasta do cliente no Drive.",
    app: "Resumo do mês, do jeito que você contaria para alguém.",
  },
];

/**
 * A comparison as a ledger, not as a table of check marks.
 *
 * A feature matrix answers "which one has more", which is the wrong question
 * when the two products are for different people. Rows of prose answer "which
 * one is mine".
 *
 * Each row lights as it arrives, driven by the section's own scroll progress
 * rather than by a per-row observer: one ScrollTrigger for the block instead of
 * four, and the rows stay in step with each other because they read one clock.
 */
export function LedgerRecursos() {
  const trilha = useRef<HTMLDivElement>(null);
  const { progress, animated } = useScrollProgress(trilha, {
    start: "top 80%",
    end: "bottom 70%",
    fallback: 1,
  });

  return (
    <div ref={trilha} className="border-t border-white/10">
      {/* Column headers, desktop only: on a phone the row stacks and each cell
          carries its own label, so a header row would be a third copy. */}
      <div className="hidden grid-cols-[1.2fr_1fr_1fr] gap-8 border-b border-white/10 pb-5 md:grid">
        <span className="[font-family:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.2em] text-white/35">
          A pergunta
        </span>
        <span className="[font-family:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.2em] text-white/35">
          ProOps ERP
        </span>
        <span className="[font-family:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.2em] text-white/35">
          {APP_NAME}
        </span>
      </div>

      {LINHAS.map((linha, index) => (
        <LinhaLedger
          key={linha.pergunta}
          linha={linha}
          indice={index}
          total={LINHAS.length}
          progresso={progress}
          animado={animated}
        />
      ))}
    </div>
  );
}

function LinhaLedger({
  linha,
  indice,
  total,
  progresso,
  animado,
}: {
  linha: Linha;
  indice: number;
  total: number;
  progresso: ReturnType<typeof useScrollProgress>["progress"];
  animado: boolean;
}) {
  const fatia = 0.6 / total;
  const de = 0.08 + indice * fatia;
  const ate = de + fatia * 2;

  const opacity = useTransform(progresso, [de, ate], [0, 1]);
  const y = useTransform(progresso, [de, ate], [24, 0]);
  const regua = useTransform(progresso, [de, ate], [0, 1]);

  return (
    <motion.div
      style={animado ? { opacity, y } : undefined}
      className="group relative grid gap-4 py-10 md:grid-cols-[1.2fr_1fr_1fr] md:gap-8"
    >
      <h3 className="[font-family:var(--font-bricolage)] text-xl font-semibold leading-snug tracking-tight text-white md:text-2xl">
        {linha.pergunta}
      </h3>

      <div>
        <p className="mb-2 [font-family:var(--font-geist-mono)] text-[10px] uppercase tracking-[0.2em] text-white/35 md:hidden">
          ProOps ERP
        </p>
        <p className="text-sm leading-relaxed text-white/60">{linha.erp}</p>
      </div>

      <div>
        <p className="mb-2 [font-family:var(--font-geist-mono)] text-[10px] uppercase tracking-[0.2em] text-white/35 md:hidden">
          {APP_NAME}
        </p>
        <p className="text-sm leading-relaxed text-white/60">{linha.app}</p>
      </div>

      {/* The rule draws with the row instead of being there before it, so the
          ledger appears to be written line by line as the reader descends. */}
      <motion.span
        aria-hidden="true"
        style={animado ? { scaleX: regua } : { scaleX: 1 }}
        className="absolute inset-x-0 bottom-0 h-px origin-left bg-white/12"
      />
    </motion.div>
  );
}
