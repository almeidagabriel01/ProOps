"use client";

import React from "react";
import { CalendarDays, Wallet } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SimpleBarChart, type BarChartDataItem } from "@/components/charts/simple-bar-chart";
import {
  ProposalStatsCard,
  ClientsStatsCard,
} from "@/app/dashboard/_components/stats-cards";
import { RecentProposalsList } from "@/app/dashboard/_components/recent-lists";
import { formatCurrency } from "@/utils/format";
import { formatDateBR } from "@/utils/date-format";
import type { Proposal } from "@/types/proposal";

/* ────────────────────────────────────────────────────────────────────────────
   DADOS DE DEMONSTRAÇÃO — AJUSTE: troque valores/labels aqui.
   São os MESMOS componentes do /dashboard real, alimentados com dados fake
   (a landing é pública, sem tenant/Firebase).
──────────────────────────────────────────────────────────────────────────── */

const DEMO_CHART_DATA: BarChartDataItem[] = [
  { name: "Jan", receitas: 42300, despesas: 28100 },
  { name: "Fev", receitas: 58900, despesas: 31400 },
  { name: "Mar", receitas: 49600, despesas: 27800 },
  { name: "Abr", receitas: 71200, despesas: 35600 },
  { name: "Mai", receitas: 64800, despesas: 30900 },
  { name: "Jun", receitas: 88400, despesas: 38200 },
];

const DEMO_PROPOSAL_STATS = {
  approved: 18,
  pending: 6,
  total: 27,
  conversionRate: 67,
};

const DEMO_CLIENTS = { totalClients: 86, newClientsThisMonth: 9 };

const DEMO_BALANCE = 128400;

// Mock parcial — só os campos que a RecentProposalsList renderiza
// (id, clientName, status, products[].total, createdAt)
const DEMO_PROPOSALS = [
  {
    id: "demo-1",
    clientName: "Residência Alphaville",
    status: "approved",
    products: [{ total: 48900 }],
    createdAt: "2026-06-08",
  },
  {
    id: "demo-2",
    clientName: "Cobertura Itaim",
    status: "sent",
    products: [{ total: 32400 }],
    createdAt: "2026-06-05",
  },
  {
    id: "demo-3",
    clientName: "Casa Riviera",
    status: "approved",
    products: [{ total: 27150 }],
    createdAt: "2026-06-02",
  },
] as unknown as Proposal[];

/* ────────────────────────────────────────────────────────────────────────────
   Header — réplica fiel do cabeçalho do /dashboard (saudação + Saldo Atual)
──────────────────────────────────────────────────────────────────────────── */

export function HeroDashboardHeader() {
  return (
    <div className="flex h-full flex-col justify-between gap-3 rounded-2xl border border-border/50 bg-background px-5 py-4 shadow-md sm:flex-row sm:items-center">
      <div>
        <h3 className="text-xl font-bold tracking-tight sm:text-2xl">
          <span className="bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
            Bom dia, ProOps!
          </span>{" "}
          <span className="text-foreground">👋</span>
        </h3>
        <p className="text-muted-foreground mt-1 flex items-center gap-2 text-xs sm:text-sm">
          <CalendarDays className="h-4 w-4" />
          {formatDateBR(new Date())}
        </p>
      </div>
      <div className="text-left sm:text-right">
        <div className="text-muted-foreground mb-1 flex items-center gap-2 sm:justify-end">
          <Wallet className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wide">Saldo Atual</span>
        </div>
        <div className="text-xl font-bold tracking-tight text-emerald-500 sm:text-2xl">
          {formatCurrency(DEMO_BALANCE)}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Fluxo de Caixa — mesmo wrapper do /dashboard (page.tsx) com SimpleBarChart
──────────────────────────────────────────────────────────────────────────── */

export function HeroCashFlowCard() {
  return (
    <Card className="flex h-full flex-col border border-border/50 bg-gradient-to-br from-background to-slate-50/30 shadow-md dark:to-slate-950/10">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Fluxo de Caixa</CardTitle>
            <CardDescription>Receitas vs Despesas dos próximos 6 meses</CardDescription>
          </div>
          <div className="hidden gap-4 text-sm lg:flex">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-sm" />
              <span className="text-muted-foreground font-medium">Receitas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-rose-500 shadow-sm" />
              <span className="text-muted-foreground font-medium">Despesas</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="min-h-[170px] flex-1 p-0 pb-4">
        <SimpleBarChart data={DEMO_CHART_DATA} />
      </CardContent>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Wrappers dos widgets reais com os dados demo
──────────────────────────────────────────────────────────────────────────── */

export function HeroProposalStats() {
  return <ProposalStatsCard stats={DEMO_PROPOSAL_STATS} />;
}

export function HeroClientsStats() {
  return (
    <ClientsStatsCard
      totalClients={DEMO_CLIENTS.totalClients}
      newClientsThisMonth={DEMO_CLIENTS.newClientsThisMonth}
    />
  );
}

export function HeroRecentProposals() {
  return <RecentProposalsList proposals={DEMO_PROPOSALS} />;
}
