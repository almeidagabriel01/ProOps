import React from "react";

import type { Captura } from "@/lib/landing/capturas";
import type { StageTemplate } from "@/lib/niches/registry";

import { CapturaDoErp } from "../_shared/captura-do-erp";
import { Accent } from "../_shared/section-heading";

interface NicheEtapasProps {
  /** O modelo de etapas REAL do nicho (espelho do backend, com paridade testada). */
  etapas: readonly StageTemplate[];
  /** O tipo de visita com que o link de agendamento nasce ("Medição"). */
  visita: string;
  /** O print da obra desse nicho no ERP. */
  captura: Captura;
}

/**
 * Do agendamento à entrega, nas etapas que a obra desse nicho nasce tendo.
 * Nada aqui é texto de landing: os nomes e os checklists são os que o sistema
 * cria na aprovação da proposta. A linha enche com a rolagem, em CSS.
 */
export function NicheEtapas({ etapas, visita, captura }: NicheEtapasProps) {
  const agendamento = ["O cliente escolhe o horário no link de agendamento", "O pedido entra na Agenda para você confirmar"];
  const obra = etapas.map((e) => ({ nome: e.name, itens: [...e.checklist] }));
  // Onde a visita é a própria primeira etapa (a Medição), as duas viram uma
  // estação só: agendada pelo link e com o checklist da etapa.
  const [primeira, ...demais] = obra;
  const inicio =
    primeira && primeira.nome === visita
      ? [{ nome: visita, itens: [agendamento[0], ...primeira.itens] }, ...demais]
      : [{ nome: visita, itens: agendamento }, ...obra];
  const estacoes = [
    ...inicio,
    { nome: "Aceite", itens: ["O cliente confere a obra pelo link", "Aceita a entrega com nome e documento"] },
  ];
  return (
    <section className="border-t border-black/10 bg-white py-24 dark:border-white/10 dark:bg-neutral-950 md:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <h2 className="max-w-3xl [font-family:var(--font-pdf-montserrat)] text-[2.1rem] font-bold leading-[1.06] tracking-[-0.025em] text-black dark:text-white md:text-5xl">
          Da {visita.toLowerCase()} à entrega, <Accent>etapa por etapa</Accent>.
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-black/60 dark:text-white/60 md:text-lg">
          Aprovada a proposta, a obra nasce com estas etapas e estes checklists. Você ajusta o modelo nas
          configurações; a equipe marca, fotografa e o cliente acompanha pelo link.
        </p>

        <div className="relative mt-16">
          {/* O trilho: vertical no celular, horizontal no desktop. */}
          <span aria-hidden="true" className="absolute bottom-0 left-[7px] top-0 w-[2px] bg-black/10 dark:bg-white/12 lg:bottom-auto lg:left-0 lg:right-0 lg:top-[7px] lg:h-[2px] lg:w-auto" />
          <span aria-hidden="true" className="etapas-trilho-cheio absolute left-0 right-0 top-[7px] hidden h-[2px] origin-left bg-[var(--acento)] lg:block" />
          <ol
            className="grid gap-10 lg:grid-cols-[repeat(var(--estacoes),minmax(0,1fr))] lg:gap-6"
            style={{ "--estacoes": estacoes.length } as React.CSSProperties}
          >
            {estacoes.map((estacao, i) => (
              <li key={estacao.nome} className="vt-revela relative pl-9 lg:pl-0 lg:pt-10">
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-0 h-4 w-4 rounded-full border-[3px] border-[var(--acento)] bg-white dark:bg-neutral-950"
                />
                <p className="text-xs font-semibold tabular-nums text-black/40 dark:text-white/40">{i + 1}</p>
                <h3 className="mt-1 [font-family:var(--font-pdf-montserrat)] text-lg font-bold text-black dark:text-white">
                  {estacao.nome}
                </h3>
                <ul className="mt-3 space-y-1.5">
                  {estacao.itens.map((item) => (
                    <li key={item} className="text-[14px] leading-snug text-black/60 dark:text-white/60">
                      {item}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
        <figure className="vt-revela mt-16">
          <CapturaDoErp captura={captura} sizes="(min-width: 1280px) 1232px, 100vw" />
          <figcaption className="mt-4 text-sm text-black/55 dark:text-white/55">A obra no ERP, com as etapas do segmento e o checklist. Tela real, com dados de exemplo.</figcaption>
        </figure>
      </div>
    </section>
  );
}
