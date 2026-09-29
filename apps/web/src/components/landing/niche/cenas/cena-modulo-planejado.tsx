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

type Dados = Extract<CenaDoNicho, { tipo: "modulo-planejado" }>;
type Peca = "roupeiro" | "bancada" | "puxadores";

const ESCALA = 70;
const PISO = 248;
const X0 = 44;
const VAO = 30; // entre o roupeiro e a bancada
const ALTURA_BANCADA = 0.9;
const LARGURA_PORTA = 0.6; // m: uma porta a cada 60 cm, no desenho

const PECA_DO_MODO: Partial<Record<ProductPricingMode, Peca>> = {
  curtain_meter: "roupeiro",
  curtain_width: "bancada",
  standard: "puxadores",
};

/**
 * Marcenaria e móveis planejados: uma parede do ambiente em elevação, com o
 * roupeiro, a bancada e os puxadores. Cada peça entra na proposta com a SUA
 * regra de preço: a frente do roupeiro por m², a bancada por metro linear e os
 * puxadores por unidade. É a pessoa quem informa cada medida na proposta; o
 * desenho só mostra de onde ela vem. A ProOps não desenha o projeto nem gera
 * plano de corte, e a cena não sugere isso.
 */
export function CenaModuloPlanejado({ dados, modulos }: { dados: Dados; modulos: readonly ModuloDaCena[] }) {
  const abas = modulos.filter((m) => m.modo && PECA_DO_MODO[m.modo]);
  const [peca, setPeca] = useState<Peca>(PECA_DO_MODO[abas[0]?.modo ?? "curtain_meter"] ?? "roupeiro");
  const [larguraRoupeiro, setLarguraRoupeiro] = useState(dados.roupeiro.largura);
  const [alturaRoupeiro, setAlturaRoupeiro] = useState(dados.roupeiro.altura);
  const [larguraBancada, setLarguraBancada] = useState(dados.bancada.largura);
  const hachura = useId();

  const portasRoupeiro = Math.max(2, Math.round(larguraRoupeiro / LARGURA_PORTA));
  const portasBancada = Math.max(2, Math.round(larguraBancada / LARGURA_PORTA));
  const puxadores = portasRoupeiro + portasBancada;

  const itens = ({
      roupeiro: calcularItem({ ...dados.roupeiro, medidas: { largura: larguraRoupeiro, altura: alturaRoupeiro } }),
      bancada: calcularItem({ ...dados.bancada, medidas: { largura: larguraBancada } }),
      puxadores: calcularItem({ ...dados.puxadores, quantidade: puxadores }),
    });
  const total = somar([itens.roupeiro.total, itens.bancada.total, itens.puxadores.total]);

  const wR = larguraRoupeiro * ESCALA;
  const hR = alturaRoupeiro * ESCALA;
  const wB = larguraBancada * ESCALA;
  const hB = ALTURA_BANCADA * ESCALA;
  const xB = X0 + wR + VAO;
  const cor = (alvo: Peca) => (peca === alvo ? "var(--acento)" : "currentColor");

  const formula = {
    roupeiro: `Frente: ${formatMeters(larguraRoupeiro)} × ${formatMeters(alturaRoupeiro)} = ${itens.roupeiro.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m², a ${formatCurrency(itens.roupeiro.precoUnitario)} o m²`,
    bancada: `${formatMeters(larguraBancada)} de bancada, a ${formatCurrency(itens.bancada.precoUnitario)} o metro linear`,
    puxadores: `${puxadores} puxadores, um por porta, a ${formatCurrency(itens.puxadores.precoUnitario)} cada`,
  }[peca];

  const desenho = (
    <svg viewBox="0 0 640 280" className="h-auto w-full">
      <defs>
        <pattern id={hachura} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="9" stroke="currentColor" strokeWidth="1" opacity="0.12" />
        </pattern>
      </defs>
      <rect x="6" y={PISO} width="628" height="16" fill={`url(#${hachura})`} />
      <line x1="6" y1={PISO} x2="634" y2={PISO} stroke="currentColor" strokeWidth="2" />

      {/* O roupeiro: a frente é o que se cobra por m². */}
      <g className="cena-peca" style={{ "--ordem": 0, "--de-y": "-22px" } as React.CSSProperties}>
        <rect
          x={X0}
          y={PISO - hR}
          width={wR}
          height={hR}
          fill={peca === "roupeiro" ? "var(--acento-suave)" : "currentColor"}
          fillOpacity={peca === "roupeiro" ? 1 : 0.04}
          stroke={cor("roupeiro")}
          strokeWidth="2.5"
          style={{ transition: "fill 0.3s ease, stroke 0.3s ease" }}
        />
        {Array.from({ length: portasRoupeiro - 1 }, (_, i) => (
          <line key={i} x1={X0 + (wR / portasRoupeiro) * (i + 1)} y1={PISO - hR} x2={X0 + (wR / portasRoupeiro) * (i + 1)} y2={PISO} stroke={cor("roupeiro")} strokeWidth="1.5" />
        ))}
        {peca === "roupeiro" ? (
          <text x={X0 + wR / 2} y={PISO - hR * 0.82} textAnchor="middle" className="fill-current text-[15px] font-bold tabular-nums">
            {itens.roupeiro.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m²
          </text>
        ) : null}
      </g>

      {/* A bancada: tampo e armário inferior, cobrados por metro linear. */}
      <g className="cena-peca" style={{ "--ordem": 1, "--de-x": "22px", "--de-y": "0px" } as React.CSSProperties}>
        <rect x={xB - 6} y={PISO - hB - 7} width={wB + 12} height="7" rx="1.5" fill={cor("bancada")} style={{ transition: "fill 0.3s ease" }} />
        <rect
          x={xB}
          y={PISO - hB}
          width={wB}
          height={hB}
          fill={peca === "bancada" ? "var(--acento-suave)" : "currentColor"}
          fillOpacity={peca === "bancada" ? 1 : 0.04}
          stroke={cor("bancada")}
          strokeWidth="2.5"
          style={{ transition: "fill 0.3s ease, stroke 0.3s ease" }}
        />
        {Array.from({ length: portasBancada - 1 }, (_, i) => (
          <line key={i} x1={xB + (wB / portasBancada) * (i + 1)} y1={PISO - hB} x2={xB + (wB / portasBancada) * (i + 1)} y2={PISO} stroke={cor("bancada")} strokeWidth="1.5" />
        ))}
      </g>

      {/* Os puxadores: um por porta, cobrados por unidade. */}
      <g className="cena-peca" style={{ "--ordem": 2, "--de-y": "8px" } as React.CSSProperties}>
        {Array.from({ length: portasRoupeiro }, (_, i) => {
          const cx = X0 + (wR / portasRoupeiro) * (i + 0.5) + (i % 2 === 0 ? 10 : -10);
          return <rect key={`r${i}`} x={cx - 2} y={PISO - hR * 0.55} width="4" height="26" rx="2" fill={cor("puxadores")} className={peca === "puxadores" ? "cena-pulso" : undefined} style={{ transition: "fill 0.3s ease" }} />;
        })}
        {Array.from({ length: portasBancada }, (_, i) => {
          const cx = xB + (wB / portasBancada) * (i + 0.5);
          return <rect key={`b${i}`} x={cx - 11} y={PISO - hB + 10} width="22" height="4" rx="2" fill={cor("puxadores")} style={{ transition: "fill 0.3s ease" }} />;
        })}
      </g>

      <Cota x1={X0} y1={PISO - hR - 16} x2={X0 + wR} y2={PISO - hR - 16} rotulo={formatMeters(larguraRoupeiro)} apagada={peca !== "roupeiro"} />
      <Cota x1={X0 - 22} y1={PISO - hR} x2={X0 - 22} y2={PISO} rotulo={formatMeters(alturaRoupeiro)} apagada={peca !== "roupeiro"} />
      <Cota x1={xB} y1={PISO - hB - 24} x2={xB + wB} y2={PISO - hB - 24} rotulo={formatMeters(larguraBancada)} apagada={peca !== "bancada"} />
    </svg>
  );

  return (
    <PalcoDaCena
      desenho={desenho}
      controles={
        <>
          <SeletorDeModo
            rotulo="Peça do orçamento"
            opcoes={abas.map((m) => ({ id: PECA_DO_MODO[m.modo!]!, rotulo: m.title }))}
            valor={peca}
            onChange={setPeca}
          />
          <div className="grid gap-4">
            <ControleDeMedida rotulo="Largura do roupeiro" valor={larguraRoupeiro} min={1.2} max={3.6} unidade="m" onChange={setLarguraRoupeiro} />
            <ControleDeMedida rotulo="Altura do roupeiro" valor={alturaRoupeiro} min={2} max={2.8} unidade="m" onChange={setAlturaRoupeiro} />
            <ControleDeMedida rotulo="Largura da bancada" valor={larguraBancada} min={1.2} max={4} unidade="m" onChange={setLarguraBancada} />
          </div>
        </>
      }
      proposta={
        <>
          <LinhaDaProposta {...itens.roupeiro} ativa={peca === "roupeiro"} />
          <LinhaDaProposta {...itens.bancada} ativa={peca === "bancada"} />
          <LinhaDaProposta {...itens.puxadores} ativa={peca === "puxadores"} />
        </>
      }
      total={total}
      rodape={formula}
    />
  );
}
