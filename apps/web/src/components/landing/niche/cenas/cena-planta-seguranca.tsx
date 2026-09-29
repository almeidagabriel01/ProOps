"use client";

import React, { useId, useState } from "react";

import { calcularItem, somar } from "@/lib/landing/proposta-de-exemplo";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/format";

import type { CenaDoNicho } from "../types";
import { LinhaDaProposta } from "./_pecas/linha-da-proposta";
import { PalcoDaCena } from "./_pecas/palco-da-cena";
import type { ModuloDaCena } from "./tipos";

type Dados = Extract<CenaDoNicho, { tipo: "planta-seguranca" }>;

const LARGURA = 460;
const ALTURA = 322;
const k = LARGURA / 100; // coordenadas da planta (0 a 100) para o SVG
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/**
 * Segurança eletrônica: a planta do terreno vista de cima, com as áreas do
 * vocabulário do nicho (Portaria, Garagem, Perímetro). Ligar um sistema põe os
 * dispositivos dele na planta e os itens dele na proposta, com subtotal por
 * sistema como no PDF. O contrato mensal aparece como a recorrência que ele
 * vira no financeiro.
 *
 * Os cones das câmeras são ilustração de ONDE a câmera olha, não cálculo de
 * cobertura: a ProOps vende e administra o projeto, e a cena não diz outra
 * coisa.
 */
export function CenaPlantaSeguranca({ dados }: { dados: Dados; modulos: readonly ModuloDaCena[] }) {
  const [ligados, setLigados] = useState<readonly string[]>([dados.sistemas[0]?.nome ?? ""]);
  const gradiente = useId();

  const grupos = dados.sistemas.map((sistema) => {
        const itens = sistema.itens.map(calcularItem);
        return { nome: sistema.nome, itens, subtotal: somar(itens.map((i) => i.total)), ligado: ligados.includes(sistema.nome) };
      });
  const total = somar(grupos.filter((g) => g.ligado).map((g) => g.subtotal));

  const alternar = (nome: string) =>
    setLigados((atual) => (atual.includes(nome) ? atual.filter((n) => n !== nome) : [...atual, nome]));

  const [perimetro, ...areas] = dados.areas;

  const desenho = (
    <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} className="h-auto w-full">
      <defs>
        {/* O cone é desenhado apontando para a direita e girado depois, então o
            gradiente linear vai da lente (esquerda) para o alcance (direita). */}
        <linearGradient id={gradiente} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--acento)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--acento)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* O perímetro, com a cerca marcada. */}
      {perimetro ? (
        <g>
          <rect x={perimetro.x * k + 2} y={perimetro.y * k + 2} width={perimetro.w * k - 4} height={perimetro.h * k - 4} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="10 5" />
          <text x={perimetro.x * k + 14} y={perimetro.y * k + 22} className="fill-current text-[11px] font-semibold" opacity="0.55">
            {perimetro.nome}
          </text>
        </g>
      ) : null}
      {/* A edificação e as áreas. */}
      <rect x={28 * k} y={8 * k} width={44 * k} height={30 * k} rx="4" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeWidth="1.5" />
      <text x={50 * k} y={23 * k} textAnchor="middle" dominantBaseline="middle" className="fill-current text-[11px] font-semibold" opacity="0.45">
        Edificação
      </text>
      {areas.map((area) => (
        <g key={area.nome}>
          <rect x={area.x * k} y={area.y * k} width={area.w * k} height={area.h * k} rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <text x={area.x * k + 10} y={area.y * k + area.h * k - 10} className="fill-current text-[11px] font-semibold" opacity="0.6">
            {area.nome}
          </text>
        </g>
      ))}

      {/* Os dispositivos de cada sistema ligado. */}
      {dados.sistemas.map((sistema) => {
        const ligado = ligados.includes(sistema.nome);
        return (
          <g key={sistema.nome} opacity={ligado ? 1 : 0} style={{ transition: "opacity 0.35s ease" }}>
            {sistema.dispositivos.map((d, i) => {
              const x = d.x * k;
              const y = d.y * k;
              if (d.tipo === "camera") {
                return (
                  <g key={i}>
                    <path
                      d={`M${x} ${y} L${x + 120} ${y - 42} A128 128 0 0 1 ${x + 120} ${y + 42} Z`}
                      fill={`url(#${gradiente})`}
                      className="cena-varre"
                      style={{ "--angulo": d.angulo ?? 0, transformOrigin: `${x}px ${y}px` } as React.CSSProperties}
                    />
                    <circle cx={x} cy={y} r="6" fill="var(--acento)" />
                    <circle cx={x} cy={y} r="2.2" className="fill-white dark:fill-neutral-950" />
                  </g>
                );
              }
              if (d.tipo === "sensor") {
                return (
                  <g key={i}>
                    <circle cx={x} cy={y} r="9" fill="none" stroke="var(--acento)" strokeWidth="1.5" className="cena-pulso" />
                    <circle cx={x} cy={y} r="4.5" fill="var(--acento)" />
                  </g>
                );
              }
              return (
                <g key={i}>
                  <rect x={x - 7} y={y - 9} width="14" height="18" rx="3" fill="var(--acento)" />
                  <circle cx={x} cy={y - 1} r="2.5" className="fill-white dark:fill-neutral-950" />
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );

  return (
    <PalcoDaCena
      desenho={desenho}
      controles={
        <div>
          <p className="mb-2 text-[13px] font-medium text-black/60 dark:text-white/60">Sistemas da proposta</p>
          <div className="flex flex-wrap gap-2">
            {dados.sistemas.map((sistema) => {
              const ligado = ligados.includes(sistema.nome);
              return (
                <button
                  key={sistema.nome}
                  type="button"
                  aria-pressed={ligado}
                  onClick={() => alternar(sistema.nome)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors duration-200",
                    ligado
                      ? "border-transparent bg-[var(--acento)] text-white dark:text-black"
                      : "border-black/15 text-black/65 hover:border-black/35 hover:text-black dark:border-white/20 dark:text-white/65 dark:hover:border-white/40 dark:hover:text-white",
                  )}
                >
                  {sistema.nome}
                </button>
              );
            })}
          </div>
        </div>
      }
      proposta={
        <div className="max-h-[19rem] overflow-y-auto">
          {grupos.map((grupo) => (
            <div key={grupo.nome} className={cn("transition-opacity duration-300", !grupo.ligado && "hidden")}>
              <div className="mt-2 flex items-baseline justify-between border-b border-black/10 pb-1 dark:border-white/12">
                <span className="text-[13px] font-bold text-[var(--acento)]">{grupo.nome}</span>
                <span className="text-[13px] font-semibold tabular-nums text-black/70 dark:text-white/70">{formatCurrency(grupo.subtotal)}</span>
              </div>
              {grupo.itens.map((item) => (
                <LinhaDaProposta key={item.descricao} {...item} />
              ))}
            </div>
          ))}
          {grupos.every((g) => !g.ligado) ? (
            <p className="py-6 text-center text-[13px] text-black/50 dark:text-white/50">Ligue um sistema na planta.</p>
          ) : null}
        </div>
      }
      total={total}
      rodape={
        <div>
          <p>
            {dados.mensalidade.descricao}:{" "}
            <strong className="font-semibold text-black dark:text-white">{formatCurrency(dados.mensalidade.valor)} por mês</strong>, em
            lançamento recorrente.
          </p>
          <ol className="mt-2 grid grid-cols-12 gap-1" aria-hidden="true">
            {MESES.map((mes, i) => (
              <li key={mes} className="flex flex-col items-center gap-1">
                <span
                  className={cn(
                    "cena-peca h-5 w-full rounded-sm border border-[var(--acento)]",
                    i === 0 ? "bg-[var(--acento)]" : "bg-[var(--acento-suave)]",
                  )}
                  style={{ "--ordem": i, "--de-y": "6px" } as React.CSSProperties}
                />
                <span className="text-[9px] text-black/40 dark:text-white/40">{mes}</span>
              </li>
            ))}
          </ol>
        </div>
      }
    />
  );
}
