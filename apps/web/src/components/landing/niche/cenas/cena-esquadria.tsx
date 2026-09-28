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

type Dados = Extract<CenaDoNicho, { tipo: "esquadria" }>;
type Peca = "vidro" | "perfil" | "ferragem";

const ESCALA = 100;
const CENTRO_X = 236;
const TOPO = 34;
const PERFIL = 9; // espessura do perfil no desenho

/** Qual peça da esquadria cada modo de preço cobra. */
const PECA_DO_MODO: Partial<Record<ProductPricingMode, Peca>> = {
  curtain_meter: "vidro",
  curtain_width: "perfil",
  standard: "ferragem",
};

/**
 * Vidraçaria e esquadrias: a janela de correr de duas folhas, em elevação. Os
 * três modos de preço aparecem na MESMA proposta, porque é assim que o
 * orçamento de uma esquadria é: o vidro pela área, o perfil pelo perímetro e
 * a ferragem por peça. A aba escolhe qual deles o desenho destaca.
 */
export function CenaEsquadria({ dados, modulos }: { dados: Dados; modulos: readonly ModuloDaCena[] }) {
  const abas = modulos.filter((m) => m.modo && PECA_DO_MODO[m.modo]);
  const [peca, setPeca] = useState<Peca>(PECA_DO_MODO[abas[0]?.modo ?? "curtain_meter"] ?? "vidro");
  const [largura, setLargura] = useState(dados.largura);
  const [altura, setAltura] = useState(dados.altura);
  const hachura = useId();

  const perimetro = 2 * (largura + altura);
  const itens = ({
      vidro: calcularItem({ ...dados.vidro, medidas: { largura, altura } }),
      perfil: calcularItem({ ...dados.perfil, medidas: { largura: perimetro } }),
      ferragem: calcularItem({ ...dados.ferragem }),
    });
  const total = somar([itens.vidro.total, itens.perfil.total, itens.ferragem.total]);

  const w = largura * ESCALA;
  const h = altura * ESCALA;
  const x0 = CENTRO_X - w / 2;
  const meio = x0 + w / 2;
  const sobra = Math.min(18, w * 0.06); // o transpasse entre as duas folhas
  const folhaEsq = { x: x0 + PERFIL, w: w / 2 - PERFIL + sobra };
  const folhaDir = { x: meio - sobra, w: w / 2 - PERFIL + sobra };
  const baseFolha = TOPO + h - PERFIL;

  const formula = {
    vidro: `${formatMeters(largura)} × ${formatMeters(altura)} = ${itens.vidro.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m², a ${formatCurrency(itens.vidro.precoUnitario)} o m²`,
    perfil: `Perímetro: 2 × (${formatMeters(largura)} + ${formatMeters(altura)}) = ${formatMeters(perimetro)}, a ${formatCurrency(itens.perfil.precoUnitario)} o metro`,
    ferragem: `${dados.ferragem.quantidade} kit, a ${formatCurrency(itens.ferragem.precoUnitario)} a unidade`,
  }[peca];

  const destaque = (alvo: Peca) => (peca === alvo ? 1 : 0);

  const desenho = (
    <svg viewBox="0 0 472 340" className="h-auto w-full">
      <defs>
        <pattern id={hachura} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="9" stroke="currentColor" strokeWidth="1" opacity="0.14" />
        </pattern>
      </defs>
      <rect x="6" y="6" width="460" height="300" fill={`url(#${hachura})`} />
      <rect x={x0} y={TOPO} width={w} height={h} className="fill-white dark:fill-neutral-950" />

      {/* O perfil: a moldura do vão. No metro linear, é ele que se cobra. */}
      <rect
        x={x0 + PERFIL / 2}
        y={TOPO + PERFIL / 2}
        width={w - PERFIL}
        height={h - PERFIL}
        fill="none"
        stroke={peca === "perfil" ? "var(--acento)" : "currentColor"}
        strokeWidth={PERFIL}
        style={{ transition: "stroke 0.3s ease" }}
      />
      <rect
        x={x0 + PERFIL / 2}
        y={TOPO + PERFIL / 2}
        width={w - PERFIL}
        height={h - PERFIL}
        fill="none"
        stroke="var(--fundo-cena, #fff)"
        strokeWidth="1.5"
        className="cena-marcha"
        opacity={destaque("perfil")}
        style={{ transition: "opacity 0.3s ease" }}
      />

      {/* As duas folhas, com o vidro. No m², é a área de vidro que se cobra. */}
      {[folhaEsq, folhaDir].map((folha, i) => (
        <g key={i} className="cena-peca" style={{ "--ordem": i, "--de-x": i === 0 ? "-14px" : "14px", "--de-y": "0px" } as React.CSSProperties}>
          <rect
            x={folha.x}
            y={TOPO + PERFIL}
            width={folha.w}
            height={h - PERFIL * 2}
            fill={peca === "vidro" ? "var(--acento-suave)" : "currentColor"}
            fillOpacity={peca === "vidro" ? 1 : 0.05}
            stroke="currentColor"
            strokeWidth="3"
            style={{ transition: "fill 0.3s ease, fill-opacity 0.3s ease" }}
          />
          <line
            x1={folha.x + 10}
            y1={TOPO + PERFIL + 30}
            x2={folha.x + Math.min(folha.w * 0.5, 70)}
            y2={TOPO + PERFIL + 10}
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.25"
          />
        </g>
      ))}
      <text x={meio} y={TOPO + h / 2} textAnchor="middle" dominantBaseline="middle" className="fill-current text-[14px] font-bold tabular-nums" opacity={destaque("vidro")} style={{ transition: "opacity 0.3s ease" }}>
        {itens.vidro.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m²
      </text>

      {/* A ferragem: roldanas e o fecho. Na unidade, é o kit que se cobra. */}
      {[folhaEsq.x + 16, folhaEsq.x + folhaEsq.w - 16, folhaDir.x + 16, folhaDir.x + folhaDir.w - 16].map((cx) => (
        <g key={cx}>
          {peca === "ferragem" ? <circle cx={cx} cy={baseFolha - 5} r="7" fill="var(--acento)" className="cena-pulso" /> : null}
          <circle cx={cx} cy={baseFolha - 5} r="4" fill={peca === "ferragem" ? "var(--acento)" : "currentColor"} style={{ transition: "fill 0.3s ease" }} />
        </g>
      ))}
      <rect x={meio - sobra - 3} y={TOPO + h / 2 - 16} width="6" height="32" rx="3" fill={peca === "ferragem" ? "var(--acento)" : "currentColor"} style={{ transition: "fill 0.3s ease" }} />

      <Cota x1={x0} y1={TOPO + h + 24} x2={x0 + w} y2={TOPO + h + 24} rotulo={formatMeters(largura)} />
      <Cota x1={x0 - 24} y1={TOPO} x2={x0 - 24} y2={TOPO + h} rotulo={formatMeters(altura)} />
    </svg>
  );

  return (
    <PalcoDaCena
      desenho={desenho}
      controles={
        <>
          <SeletorDeModo
            rotulo="Parte do orçamento"
            opcoes={abas.map((m) => ({ id: PECA_DO_MODO[m.modo!]!, rotulo: m.title }))}
            valor={peca}
            onChange={setPeca}
          />
          <div className="grid gap-4">
            <ControleDeMedida rotulo="Largura do vão" valor={largura} min={0.6} max={3.6} unidade="m" onChange={setLargura} />
            <ControleDeMedida rotulo="Altura do vão" valor={altura} min={0.6} max={2.4} unidade="m" onChange={setAltura} />
          </div>
        </>
      }
      proposta={
        <>
          <LinhaDaProposta {...itens.vidro} ativa={peca === "vidro"} />
          <LinhaDaProposta {...itens.perfil} ativa={peca === "perfil"} />
          <LinhaDaProposta {...itens.ferragem} ativa={peca === "ferragem"} />
        </>
      }
      total={total}
      rodape={formula}
    />
  );
}
