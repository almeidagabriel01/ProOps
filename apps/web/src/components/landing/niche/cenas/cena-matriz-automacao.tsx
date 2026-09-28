"use client";

import React, { useId, useState } from "react";

import { calcularItem, somar } from "@/lib/landing/proposta-de-exemplo";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/format";

import type { CenaDoNicho } from "../types";
import { LinhaDaProposta } from "./_pecas/linha-da-proposta";
import { PalcoDaCena } from "./_pecas/palco-da-cena";
import type { ModuloDaCena } from "./tipos";

type Dados = Extract<CenaDoNicho, { tipo: "matriz-automacao" }>;
type Glifo = Dados["sistemas"][number]["glifo"];

const LARGURA = 460;
const ALTURA = 322;
const k = LARGURA / 100;

const chave = (ambiente: number, sistema: number) => `${ambiente}:${sistema}`;

/** O símbolo de cada sistema dentro do cômodo, desenhado em torno de (x, y). */
function GlifoDoSistema({ glifo, x, y, gradiente }: { glifo: Glifo; x: number; y: number; gradiente: string }) {
  switch (glifo) {
    case "luz":
      return (
        <g>
          <circle cx={x} cy={y} r="34" fill={`url(#${gradiente})`} />
          <circle cx={x} cy={y} r="5" fill="var(--acento)" />
        </g>
      );
    case "som":
      return (
        <g fill="none" stroke="var(--acento)" strokeWidth="2" strokeLinecap="round">
          <rect x={x - 5} y={y - 6} width="7" height="12" rx="1.5" fill="var(--acento)" stroke="none" />
          <path d={`M${x + 6} ${y - 7} q7 7 0 14`} className="cena-pulso" />
          <path d={`M${x + 11} ${y - 12} q12 12 0 24`} opacity="0.6" />
        </g>
      );
    case "rede":
      return (
        <g fill="none" stroke="var(--acento)" strokeWidth="2" strokeLinecap="round">
          <path d={`M${x - 14} ${y - 2} a20 20 0 0 1 28 0`} />
          <path d={`M${x - 8} ${y + 4} a11 11 0 0 1 16 0`} />
          <circle cx={x} cy={y + 10} r="2.5" fill="var(--acento)" stroke="none" />
        </g>
      );
    case "persiana":
      return (
        <g stroke="var(--acento)" strokeWidth="2" strokeLinecap="round">
          {[0, 5, 10, 15].map((d) => (
            <line key={d} x1={x - 12} y1={y - 8 + d} x2={x + 12} y2={y - 8 + d} />
          ))}
        </g>
      );
  }
}

/**
 * Automação residencial: a matriz de ambientes por sistemas, que é como o
 * integrador pensa o projeto, ao lado da planta. Ligar uma célula põe o símbolo
 * do sistema no cômodo e o item na proposta, que se agrupa por sistema (a
 * solução, no vocabulário do nicho) com subtotal, como no PDF.
 *
 * É especificação e venda: a ProOps não controla a casa do cliente, e nada na
 * cena sugere isso.
 */
export function CenaMatrizAutomacao({ dados }: { dados: Dados; modulos: readonly ModuloDaCena[] }) {
  const [ligadas, setLigadas] = useState<ReadonlySet<string>>(
    () => new Set(dados.inicial.map(([a, s]) => chave(a, s))),
  );
  const gradiente = useId();

  const alternar = (a: number, s: number) =>
    setLigadas((atual) => {
      const nova = new Set(atual);
      const c = chave(a, s);
      if (nova.has(c)) nova.delete(c);
      else nova.add(c);
      return nova;
    });

  const grupos = dados.sistemas
        .map((sistema, s) => {
          const itens = dados.ambientes
            .map((ambiente, a) =>
              ligadas.has(chave(a, s))
                ? calcularItem({ ...sistema.item, descricao: `${ambiente.nome}: ${sistema.item.descricao}` })
                : null,
            )
            .filter((i): i is NonNullable<typeof i> => i !== null);
          return { nome: sistema.nome, itens, subtotal: somar(itens.map((i) => i.total)) };
        })
        .filter((g) => g.itens.length > 0);
  const total = somar(grupos.map((g) => g.subtotal));

  const desenho = (
    <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} className="h-auto w-full">
      <defs>
        <radialGradient id={gradiente}>
          <stop offset="0%" stopColor="var(--acento)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--acento)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="2" y="2" width={LARGURA - 4} height={ALTURA - 4} rx="6" fill="none" stroke="currentColor" strokeWidth="3" />
      {dados.ambientes.map((ambiente, a) => {
        const ativos = dados.sistemas.map((s, i) => ({ s, i })).filter(({ i }) => ligadas.has(chave(a, i)));
        const cx = (ambiente.x + ambiente.w / 2) * k;
        const cy = (ambiente.y + ambiente.h / 2) * k;
        const passo = 56;
        return (
          <g key={ambiente.nome}>
            <rect x={ambiente.x * k} y={ambiente.y * k} width={ambiente.w * k} height={ambiente.h * k} rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <text x={ambiente.x * k + 12} y={ambiente.y * k + 22} className="fill-current text-[12px] font-semibold" opacity="0.65">
              {ambiente.nome}
            </text>
            {ativos.map(({ s, i }, n) => (
              <g key={s.nome} className="cena-peca" style={{ "--ordem": n, "--de-y": "8px" } as React.CSSProperties}>
                <GlifoDoSistema glifo={s.glifo} x={cx + (n - (ativos.length - 1) / 2) * passo} y={cy + 6} gradiente={gradiente} />
                <title>{`${ambiente.nome}: ${dados.sistemas[i].nome}`}</title>
              </g>
            ))}
          </g>
        );
      })}
    </svg>
  );

  return (
    <PalcoDaCena
      desenho={desenho}
      controles={
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-1 text-[12.5px]">
            <caption className="sr-only">Sistemas em cada ambiente</caption>
            <thead>
              <tr>
                <th scope="col" className="sr-only">
                  Ambiente
                </th>
                {dados.sistemas.map((s) => (
                  <th key={s.nome} scope="col" className="px-1 pb-1 text-center font-semibold text-black/60 dark:text-white/60">
                    {s.nome}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dados.ambientes.map((ambiente, a) => (
                <tr key={ambiente.nome}>
                  <th scope="row" className="pr-2 text-left font-semibold text-black dark:text-white">
                    {ambiente.nome}
                  </th>
                  {dados.sistemas.map((sistema, s) => {
                    const ligada = ligadas.has(chave(a, s));
                    return (
                      <td key={sistema.nome} className="p-0">
                        <button
                          type="button"
                          aria-pressed={ligada}
                          aria-label={`${sistema.nome} em ${ambiente.nome}`}
                          onClick={() => alternar(a, s)}
                          className={cn(
                            "grid h-9 w-full place-items-center rounded-lg border transition-colors duration-200",
                            ligada
                              ? "border-transparent bg-[var(--acento)]"
                              : "border-black/12 hover:border-black/35 dark:border-white/15 dark:hover:border-white/40",
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              "h-2 w-2 rounded-full transition-transform duration-200",
                              ligada ? "scale-100 bg-white dark:bg-black" : "scale-75 bg-black/20 dark:bg-white/25",
                            )}
                          />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
      proposta={
        <div className="max-h-[19rem] overflow-y-auto">
          {grupos.map((grupo) => (
            <div key={grupo.nome}>
              <div className="mt-2 flex items-baseline justify-between border-b border-black/10 pb-1 dark:border-white/12">
                <span className="text-[13px] font-bold text-[var(--acento)]">{grupo.nome}</span>
                <span className="text-[13px] font-semibold tabular-nums text-black/70 dark:text-white/70">{formatCurrency(grupo.subtotal)}</span>
              </div>
              {grupo.itens.map((item) => (
                <LinhaDaProposta key={item.descricao} {...item} />
              ))}
            </div>
          ))}
          {grupos.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-black/50 dark:text-white/50">Ligue um sistema em algum ambiente.</p>
          ) : null}
        </div>
      }
      total={total}
      rodape="Cada célula é um item da proposta, agrupado pelo sistema, com subtotal por sistema no PDF."
    />
  );
}
