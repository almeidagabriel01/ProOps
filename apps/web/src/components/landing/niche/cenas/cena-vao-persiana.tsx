"use client";

import React, { useId, useState } from "react";

import { calcularItem, faixaParaAltura } from "@/lib/landing/proposta-de-exemplo";
import { formatMeters, type CurtainHeightTier } from "@/lib/product-pricing";
import { formatCurrency } from "@/utils/format";

import type { CenaDoNicho } from "../types";
import { ControleDeMedida } from "./_pecas/controle-de-medida";
import { Cota } from "./_pecas/cota";
import { LinhaDaProposta } from "./_pecas/linha-da-proposta";
import { PalcoDaCena } from "./_pecas/palco-da-cena";
import { SeletorDeModo } from "./_pecas/seletor-de-modo";
import type { ModuloDaCena } from "./tipos";

type Dados = Extract<CenaDoNicho, { tipo: "vao-persiana" }>;
type Modo = keyof Dados["produtos"];

const ESCALA = 80; // px por metro no desenho
const CENTRO_X = 236;
const TOPO = 38;

/**
 * Persianas e toldos: o vão visto de frente, em desenho técnico. A largura e a
 * altura são arrastáveis, e o modo de cobrança troca o que o desenho destaca:
 * a área do tecido (m²), a faixa de altura em que o vão cai, ou só a largura
 * (bandô e trilho). O total é o do motor de preço da proposta de verdade.
 */
export function CenaVaoPersiana({ dados, modulos }: { dados: Dados; modulos: readonly ModuloDaCena[] }) {
  const modos = modulos.filter(
    (m): m is ModuloDaCena & { modo: Modo } => !!m.modo && m.modo !== "standard" && !!dados.produtos[m.modo as Modo],
  );
  const [modo, setModo] = useState<Modo>(modos[0]?.modo ?? "curtain_meter");
  const [largura, setLargura] = useState(dados.largura);
  const [altura, setAltura] = useState(dados.altura);
  const hachura = useId();

  const item = dados.produtos[modo]!;
  const faixas: readonly CurtainHeightTier[] =
    item.produto.pricingModel.mode === "curtain_height" ? item.produto.pricingModel.tiers : [];
  const faixaId = faixas.length ? faixaParaAltura(faixas, altura) : undefined;
  const faixaAtiva = faixas.find((f) => f.id === faixaId);

  const calculado = calcularItem({
        descricao: item.descricao,
        produto: item.produto,
        medidas: modo === "curtain_meter" ? { largura, altura } : modo === "curtain_height" ? { largura, faixaId } : { largura },
      });

  const w = largura * ESCALA;
  const h = altura * ESCALA;
  const x0 = CENTRO_X - w / 2;
  const descida = 0.78;

  const formula =
    modo === "curtain_meter"
      ? `${formatMeters(largura)} × ${formatMeters(altura)} = ${calculado.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m², a ${formatCurrency(calculado.precoUnitario)} o m²`
      : modo === "curtain_height"
        ? `Faixa até ${formatMeters(faixaAtiva?.maxHeight ?? 0)}: ${formatMeters(largura)} de largura, a ${formatCurrency(calculado.precoUnitario)} o metro`
        : `${formatMeters(largura)} de largura, a ${formatCurrency(calculado.precoUnitario)} o metro`;

  const desenho = (
    <svg viewBox="0 0 460 340" className="h-auto w-full">
      <defs>
        <pattern id={hachura} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="9" stroke="currentColor" strokeWidth="1" opacity="0.14" />
        </pattern>
      </defs>
      {/* A parede em corte, com o vão aberto nela. */}
      <rect x="10" y="10" width="440" height="300" fill={`url(#${hachura})`} />
      <rect x={x0} y={TOPO} width={w} height={h} className="fill-white dark:fill-neutral-950" stroke="currentColor" strokeWidth="2" />
      <line x1={x0 + 8} y1={TOPO + 8} x2={x0 + Math.min(w, h) * 0.35} y2={TOPO + Math.min(w, h) * 0.35} stroke="currentColor" strokeWidth="1" opacity="0.18" />

      {/* Por área: a persiana rolô desce e a área do tecido é o que se cobra. */}
      <g opacity={modo === "curtain_meter" ? 1 : 0} style={{ transition: "opacity 0.35s ease" }}>
        <rect x={x0 - 6} y={TOPO - 12} width={w + 12} height="12" rx="6" fill="var(--acento)" />
        <rect className="cena-peca" x={x0} y={TOPO} width={w} height={h * descida} fill="var(--acento-suave)" stroke="var(--acento)" strokeWidth="1.5" />
        {Array.from({ length: Math.floor((h * descida) / 14) }, (_, i) => (
          <line key={i} x1={x0} y1={TOPO + 14 * (i + 1)} x2={x0 + w} y2={TOPO + 14 * (i + 1)} stroke="var(--acento)" strokeWidth="0.6" opacity="0.35" />
        ))}
        <rect x={x0 - 2} y={TOPO + h * descida - 3} width={w + 4} height="6" rx="3" fill="var(--acento)" />
        <text x={CENTRO_X} y={TOPO + (h * descida) / 2} textAnchor="middle" dominantBaseline="middle" className="fill-current text-[15px] font-bold tabular-nums">
          {calculado.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m²
        </text>
      </g>

      {/* Por faixa: a cortina de trilho, e as faixas de altura ao lado. */}
      <g opacity={modo === "curtain_height" ? 1 : 0} style={{ transition: "opacity 0.35s ease" }}>
        <line x1={x0 - 14} y1={TOPO - 8} x2={x0 + w + 14} y2={TOPO - 8} stroke="var(--acento)" strokeWidth="4" strokeLinecap="round" />
        <path
          d={dobras(x0, TOPO - 6, w, h + 4)}
          fill="var(--acento-suave)"
          stroke="var(--acento)"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        {faixas.map((faixa) => {
          const y = TOPO + faixa.maxHeight * ESCALA;
          const ativa = faixa.id === faixaId;
          return (
            <g key={faixa.id} opacity={ativa ? 1 : 0.4} style={{ transition: "opacity 0.3s ease" }}>
              <line x1={x0 + w + 20} y1={y} x2={x0 + w + 70} y2={y} stroke={ativa ? "var(--acento)" : "currentColor"} strokeWidth={ativa ? 2.5 : 1} strokeDasharray={ativa ? undefined : "4 3"} />
              <text x={x0 + w + 74} y={y} dominantBaseline="middle" className="fill-current text-[11px] font-semibold tabular-nums">
                até {formatMeters(faixa.maxHeight)}
              </text>
            </g>
          );
        })}
      </g>

      {/* Por largura: o bandô e o trilho, cobrados pelo comprimento. */}
      <g opacity={modo === "curtain_width" ? 1 : 0} style={{ transition: "opacity 0.35s ease" }}>
        <rect x={x0 - 10} y={TOPO - 26} width={w + 20} height="22" rx="3" fill="var(--acento)" />
        <line x1={x0 - 10} y1={TOPO - 2} x2={x0 + w + 10} y2={TOPO - 2} stroke="currentColor" strokeWidth="2" />
        <rect x={x0} y={TOPO} width={w} height={h * 0.45} fill="currentColor" opacity="0.06" />
      </g>

      <Cota x1={x0} y1={TOPO + h + 26} x2={x0 + w} y2={TOPO + h + 26} rotulo={formatMeters(largura)} />
      <Cota x1={x0 - 28} y1={TOPO} x2={x0 - 28} y2={TOPO + h} rotulo={formatMeters(altura)} apagada={modo === "curtain_width"} />
    </svg>
  );

  return (
    <PalcoDaCena
      desenho={desenho}
      controles={
        <>
          <SeletorDeModo
            rotulo="Modo de cobrança"
            opcoes={modos.map((m) => ({ id: m.modo, rotulo: m.title }))}
            valor={modo}
            onChange={setModo}
          />
          <div className="grid gap-4">
            <ControleDeMedida rotulo="Largura do vão" valor={largura} min={0.8} max={4} unidade="m" onChange={setLargura} />
            <ControleDeMedida rotulo="Altura do vão" valor={altura} min={0.8} max={3.2} unidade="m" onChange={setAltura} />
          </div>
        </>
      }
      proposta={<LinhaDaProposta descricao={calculado.descricao} medida={calculado.medida} total={calculado.total} ativa />}
      total={calculado.total}
      rodape={formula}
    />
  );
}

/** A cortina de trilho em pregas: uma onda que desce da largura inteira. */
function dobras(x: number, y: number, w: number, h: number): string {
  const pregas = Math.max(4, Math.round(w / 26));
  const passo = w / pregas;
  let topo = `M${x} ${y}`;
  for (let i = 0; i < pregas; i++) {
    const cx = x + passo * i + passo / 2;
    topo += ` Q${cx} ${y + 7} ${x + passo * (i + 1)} ${y}`;
  }
  let base = ` L${x + w} ${y + h}`;
  for (let i = pregas; i > 0; i--) {
    const cx = x + passo * i - passo / 2;
    base += ` Q${cx} ${y + h + 7} ${x + passo * (i - 1)} ${y + h}`;
  }
  return `${topo}${base} Z`;
}
