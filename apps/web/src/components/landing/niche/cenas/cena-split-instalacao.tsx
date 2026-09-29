"use client";

import React, { useId, useState } from "react";

import { calcularItem, somar } from "@/lib/landing/proposta-de-exemplo";
import { formatMeters, type ProductPricingMode } from "@/lib/product-pricing";
import { formatCurrency } from "@/utils/format";

import type { CenaDoNicho } from "../types";
import { ControleDeMedida } from "./_pecas/controle-de-medida";
import { Cota } from "./_pecas/cota";
import { LinhaDaProposta } from "./_pecas/linha-da-proposta";
import { PalcoDaCena } from "./_pecas/palco-da-cena";
import { SeletorDeModo } from "./_pecas/seletor-de-modo";
import type { ModuloDaCena } from "./tipos";

type Dados = Extract<CenaDoNicho, { tipo: "split-instalacao" }>;
type Peca = "aparelho" | "tubulacao";

const PECA_DO_MODO: Partial<Record<ProductPricingMode, Peca>> = {
  standard: "aparelho",
  curtain_width: "tubulacao",
};

const PAREDE_X = 300;
const PAREDE_L = 22;
const EVAP_Y = 58;
const PISO = 250;
/** Quanto a condensadora se afasta da parede por metro de tubulação, no desenho. */
const PX_POR_METRO = 16;

const btus = (valor: number) => `${valor.toLocaleString("pt-BR")} BTUs`;

/**
 * Climatização: o corte da parede, com a evaporadora do lado de dentro, a
 * condensadora do lado de fora e a tubulação de cobre entre as duas. Cada peça
 * entra na proposta com a SUA regra: o aparelho e a instalação por unidade, a
 * tubulação pelo comprimento. A pessoa escolhe a capacidade; a ProOps não
 * calcula carga térmica, e a cena não sugere isso.
 */
export function CenaSplitInstalacao({ dados, modulos }: { dados: Dados; modulos: readonly ModuloDaCena[] }) {
  const abas = modulos.filter((m) => m.modo && PECA_DO_MODO[m.modo]);
  const [peca, setPeca] = useState<Peca>(PECA_DO_MODO[abas[0]?.modo ?? "standard"] ?? "aparelho");
  const [capacidade, setCapacidade] = useState(dados.aparelhos[0]?.btus ?? 0);
  const [comprimento, setComprimento] = useState(dados.tubulacao.comprimento);
  const hachura = useId();

  const aparelho = dados.aparelhos.find((a) => a.btus === capacidade) ?? dados.aparelhos[0];
  const itens = {
    aparelho: calcularItem({ ...aparelho, quantidade: 1 }),
    tubulacao: {
      ...calcularItem({ ...dados.tubulacao, medidas: { largura: comprimento } }),
      medida: `Comprimento ${formatMeters(comprimento)}`,
    },
    instalacao: calcularItem({ ...dados.instalacao, quantidade: 1 }),
  };
  const total = somar([itens.aparelho.total, itens.tubulacao.total, itens.instalacao.total]);

  // A evaporadora cresce um pouco com a capacidade, só para a troca ser vista.
  const maior = Math.max(...dados.aparelhos.map((a) => a.btus));
  const larguraEvap = 120 + 70 * (capacidade / maior);
  const evapX = PAREDE_X - 18 - larguraEvap;
  const condX = PAREDE_X + PAREDE_L + 24 + Math.min(comprimento, 15) * PX_POR_METRO;
  const condY = PISO - 92;
  const cor = (alvo: Peca) => (peca === alvo ? "var(--acento)" : "currentColor");

  const formula = {
    aparelho: `${aparelho.descricao} por unidade, a ${formatCurrency(itens.aparelho.precoUnitario)}, e a instalação a ${formatCurrency(itens.instalacao.precoUnitario)}`,
    tubulacao: `${formatMeters(comprimento)} de tubulação, a ${formatCurrency(itens.tubulacao.precoUnitario)} o metro`,
  }[peca];

  const desenho = (
    <svg viewBox="0 0 640 280" className="h-auto w-full">
      <defs>
        <pattern id={hachura} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="9" stroke="currentColor" strokeWidth="1" opacity="0.18" />
        </pattern>
      </defs>
      <line x1="6" y1={PISO} x2="634" y2={PISO} stroke="currentColor" strokeWidth="2" />
      {/* A parede, cortada: dentro à esquerda, fora à direita. */}
      <rect x={PAREDE_X} y="20" width={PAREDE_L} height={PISO - 20} fill={`url(#${hachura})`} stroke="currentColor" strokeWidth="1.5" />
      <text x={PAREDE_X - 12} y="36" textAnchor="end" className="fill-current text-[12px] opacity-50">Dentro</text>
      <text x={PAREDE_X + PAREDE_L + 12} y="36" className="fill-current text-[12px] opacity-50">Fora</text>

      {/* A evaporadora, na parede de dentro. */}
      <g className="cena-peca" style={{ "--ordem": 0, "--de-y": "-18px" } as React.CSSProperties}>
        <rect
          x={evapX}
          y={EVAP_Y}
          width={larguraEvap}
          height="46"
          rx="10"
          fill={peca === "aparelho" ? "var(--acento-suave)" : "currentColor"}
          fillOpacity={peca === "aparelho" ? 1 : 0.05}
          stroke={cor("aparelho")}
          strokeWidth="2.5"
          style={{ transition: "fill 0.3s ease, stroke 0.3s ease, width 0.3s ease, x 0.3s ease" }}
        />
        <line x1={evapX + 14} y1={EVAP_Y + 34} x2={evapX + larguraEvap - 14} y2={EVAP_Y + 34} stroke={cor("aparelho")} strokeWidth="1.5" />
        {peca === "aparelho" ? (
          <text x={evapX + larguraEvap / 2} y={EVAP_Y + 24} textAnchor="middle" className="fill-current text-[13px] font-bold tabular-nums">
            {btus(capacidade)}
          </text>
        ) : null}
      </g>

      {/* A condensadora, fora, no suporte. */}
      <g className="cena-peca" style={{ "--ordem": 1, "--de-x": "22px", "--de-y": "0px" } as React.CSSProperties}>
        <rect
          x={condX}
          y={condY}
          width="112"
          height="84"
          rx="6"
          fill={peca === "aparelho" ? "var(--acento-suave)" : "currentColor"}
          fillOpacity={peca === "aparelho" ? 1 : 0.05}
          stroke={cor("aparelho")}
          strokeWidth="2.5"
          style={{ transition: "fill 0.3s ease, stroke 0.3s ease, x 0.3s ease" }}
        />
        <circle cx={condX + 50} cy={condY + 42} r="26" fill="none" stroke={cor("aparelho")} strokeWidth="2" />
        <line x1={condX + 50} y1={condY + 16} x2={condX + 50} y2={condY + 68} stroke={cor("aparelho")} strokeWidth="1.5" />
        <line x1={condX + 24} y1={condY + 42} x2={condX + 76} y2={condY + 42} stroke={cor("aparelho")} strokeWidth="1.5" />
        <rect x={condX - 4} y={PISO - 8} width="120" height="8" fill="currentColor" opacity="0.25" />
      </g>

      {/* A tubulação de cobre: sai da evaporadora, atravessa a parede e desce. */}
      <g className="cena-peca" style={{ "--ordem": 2, "--de-y": "0px" } as React.CSSProperties}>
        <path
          d={`M ${evapX + larguraEvap} ${EVAP_Y + 18} H ${condX + 56} V ${condY}`}
          fill="none"
          stroke={cor("tubulacao")}
          strokeWidth={peca === "tubulacao" ? 5 : 3}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={peca === "tubulacao" ? "cena-pulso" : undefined}
          style={{ transition: "stroke 0.3s ease, stroke-width 0.3s ease" }}
        />
      </g>

      <Cota
        x1={evapX + larguraEvap}
        y1={EVAP_Y - 18}
        x2={condX + 56}
        y2={EVAP_Y - 18}
        rotulo={`${formatMeters(comprimento)} de tubulação`}
        apagada={peca !== "tubulacao"}
      />
    </svg>
  );

  return (
    <PalcoDaCena
      desenho={desenho}
      controles={
        <>
          <SeletorDeModo
            rotulo="Item do orçamento"
            opcoes={abas.map((m) => ({ id: PECA_DO_MODO[m.modo!]!, rotulo: m.title }))}
            valor={peca}
            onChange={setPeca}
          />
          <SeletorDeModo
            rotulo="Capacidade do aparelho"
            opcoes={dados.aparelhos.map((a) => ({ id: String(a.btus), rotulo: btus(a.btus) }))}
            valor={String(capacidade)}
            onChange={(id) => setCapacidade(Number(id))}
          />
          <ControleDeMedida rotulo="Comprimento da tubulação" valor={comprimento} min={2} max={15} passo={0.5} unidade="m" onChange={setComprimento} />
        </>
      }
      proposta={
        <>
          <LinhaDaProposta {...itens.aparelho} ativa={peca === "aparelho"} />
          <LinhaDaProposta {...itens.tubulacao} ativa={peca === "tubulacao"} />
          <LinhaDaProposta {...itens.instalacao} ativa={peca === "aparelho"} />
        </>
      }
      total={total}
      rodape={formula}
    />
  );
}
