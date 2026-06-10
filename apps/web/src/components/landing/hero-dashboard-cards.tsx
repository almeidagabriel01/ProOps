"use client";

import React from "react";
import { ArrowUpRight, TrendingUp, Wallet, FileText, Target } from "lucide-react";

/* ────────────────────────────────────────────────────────────────────────────
   DADOS FAKE — AJUSTE: troque valores/labels aqui
──────────────────────────────────────────────────────────────────────────── */

const BAR_DATA = [
  { label: "Jan", value: 42 },
  { label: "Fev", value: 58 },
  { label: "Mar", value: 49 },
  { label: "Abr", value: 71 },
  { label: "Mai", value: 64 },
  { label: "Jun", value: 88 },
];

const TABLE_DATA = [
  { name: "Residência Alphaville", value: "R$ 48.900", status: "Aprovada", tone: "emerald" },
  { name: "Cobertura Itaim", value: "R$ 32.400", status: "Enviada", tone: "blue" },
  { name: "Casa Riviera", value: "R$ 27.150", status: "Rascunho", tone: "neutral" },
  { name: "Apto Moema", value: "R$ 19.800", status: "Aprovada", tone: "emerald" },
] as const;

const LINE_POINTS = [12, 38, 30, 52, 44, 68, 60, 84];

const DONUT_PERCENT = 72;

/* ────────────────────────────────────────────────────────────────────────────
   BASE — superfície compartilhada dos cards
──────────────────────────────────────────────────────────────────────────── */

interface CardShellProps {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  className?: string;
}

function CardShell({ title, icon: Icon, children, className }: CardShellProps) {
  return (
    <div
      className={`flex h-full flex-col gap-3 rounded-2xl border border-black/8 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.12)] dark:border-white/10 dark:bg-neutral-900 sm:p-5 ${className ?? ""}`}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-black/[0.04] dark:bg-white/[0.06]">
          <Icon className="h-3.5 w-3.5 text-black/55 dark:text-white/55" />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-black/45 dark:text-white/40 [font-family:var(--font-pdf-inter)]">
          {title}
        </span>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   1. BARRAS — Receita por mês
──────────────────────────────────────────────────────────────────────────── */

export function HeroBarChartCard() {
  const max = Math.max(...BAR_DATA.map((d) => d.value));
  return (
    <CardShell title="Receita por mês" icon={TrendingUp}>
      <div className="flex h-full items-end gap-2 sm:gap-3">
        {BAR_DATA.map((d, i) => (
          <div key={d.label} className="flex flex-1 flex-col items-center justify-end gap-1.5">
            <div
              className={`w-full rounded-md ${
                i === BAR_DATA.length - 1
                  ? "bg-black dark:bg-white"
                  : "bg-black/[0.18] dark:bg-white/[0.22]"
              }`}
              // altura em px (não %) — independe da cadeia de flex ter altura definida
              style={{ height: `${Math.round((d.value / max) * 88) + 8}px` }}
            />
            <span className="text-[10px] text-black/40 dark:text-white/35 [font-family:var(--font-pdf-inter)]">
              {d.label}
            </span>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   2. TABELA — Últimas propostas
──────────────────────────────────────────────────────────────────────────── */

const STATUS_TONES = {
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  neutral: "bg-black/[0.05] text-black/50 dark:bg-white/[0.08] dark:text-white/50",
} as const;

export function HeroTableCard() {
  return (
    <CardShell title="Últimas propostas" icon={FileText}>
      <div className="flex h-full flex-col justify-center gap-2">
        {TABLE_DATA.map((row) => (
          <div key={row.name} className="flex items-center gap-2 text-[12px] [font-family:var(--font-pdf-inter)]">
            <span className="flex-1 truncate text-black/70 dark:text-white/65">{row.name}</span>
            <span className="font-semibold tabular-nums text-black/85 dark:text-white/85">{row.value}</span>
            <span
              className={`hidden flex-shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] sm:inline-block ${STATUS_TONES[row.tone]}`}
            >
              {row.status}
            </span>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   3. KPI — número grande + variação
──────────────────────────────────────────────────────────────────────────── */

export function HeroKpiCard() {
  return (
    <CardShell title="Faturamento do mês" icon={Wallet}>
      <div className="flex h-full flex-col justify-center gap-1.5">
        <span className="text-3xl font-semibold tracking-[-0.03em] text-black dark:text-white sm:text-4xl [font-family:var(--font-pdf-montserrat)]">
          R$ 128,4k
        </span>
        <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 [font-family:var(--font-pdf-inter)]">
          <ArrowUpRight className="h-3.5 w-3.5" />
          +18,2%
          <span className="font-normal text-black/40 dark:text-white/35">vs. mês anterior</span>
        </span>
      </div>
    </CardShell>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   4. LINHA — Vendas (SVG com área em gradiente)
──────────────────────────────────────────────────────────────────────────── */

export function HeroLineChartCard() {
  const w = 200;
  const h = 70;
  const step = w / (LINE_POINTS.length - 1);
  const max = Math.max(...LINE_POINTS);
  const coords = LINE_POINTS.map((v, i) => [i * step, h - (v / max) * (h - 8) - 4] as const);
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  const [lastX, lastY] = coords[coords.length - 1];

  return (
    <CardShell title="Vendas" icon={TrendingUp}>
      <div className="flex h-full min-h-24 items-end">
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id="hero-line-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" className="[stop-color:rgba(0,0,0,0.14)] dark:[stop-color:rgba(255,255,255,0.18)]" />
              <stop offset="100%" className="[stop-color:rgba(0,0,0,0)] dark:[stop-color:rgba(255,255,255,0)]" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#hero-line-fill)" />
          <path d={line} fill="none" strokeWidth="2.5" className="stroke-black dark:stroke-white" vectorEffect="non-scaling-stroke" />
          <circle cx={lastX} cy={lastY} r="3.5" className="fill-black dark:fill-white" />
        </svg>
      </div>
    </CardShell>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   5. DONUT — Taxa de conversão (stroke-dasharray)
──────────────────────────────────────────────────────────────────────────── */

export function HeroDonutCard() {
  const r = 34;
  const circumference = 2 * Math.PI * r;
  const filled = (DONUT_PERCENT / 100) * circumference;

  return (
    <CardShell title="Taxa de conversão" icon={Target}>
      <div className="flex h-full items-center justify-center gap-4">
        <svg viewBox="0 0 84 84" className="h-20 w-20 -rotate-90 sm:h-24 sm:w-24" aria-hidden="true">
          <circle cx="42" cy="42" r={r} fill="none" strokeWidth="9" className="stroke-black/[0.08] dark:stroke-white/[0.1]" />
          <circle
            cx="42"
            cy="42"
            r={r}
            fill="none"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference - filled}`}
            className="stroke-black dark:stroke-white"
          />
        </svg>
        <div className="flex flex-col">
          <span className="text-2xl font-semibold tracking-[-0.02em] text-black dark:text-white [font-family:var(--font-pdf-montserrat)]">
            {DONUT_PERCENT}%
          </span>
          <span className="text-[11px] text-black/45 dark:text-white/40 [font-family:var(--font-pdf-inter)]">
            propostas fechadas
          </span>
        </div>
      </div>
    </CardShell>
  );
}
