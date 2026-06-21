"use client";

import React from "react";
import {
  Bell,
  CalendarDays,
  Contact,
  FilePenLine,
  LayoutDashboard,
  LogOut,
  Moon,
  Package2,
  ReceiptText,
  Search,
  Wallet,
  Wrench,
} from "lucide-react";
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
] as unknown as Proposal[];

/* ────────────────────────────────────────────────────────────────────────────
   SHELL ESTÁTICO — réplica do "casco" real do app (topbar + dock + header do
   dashboard). Fica fixo como pano de fundo enquanto os widgets voam para
   dentro, como no steep.app.
──────────────────────────────────────────────────────────────────────────── */

/** Topbar — réplica do Header real do app (busca, tema, sino, empresa/avatar) */
export function HeroAppTopbar() {
  return (
    <div className="flex h-[52px] items-center justify-between rounded-t-[1.75rem] border-b border-border/60 bg-background/80 px-5 backdrop-blur-md">
      <div className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1.5 text-muted-foreground">
        <Search className="h-3.5 w-3.5" />
        <span className="text-xs">Buscar...</span>
        <kbd className="ml-2 hidden rounded border border-border/60 bg-background px-1 text-[10px] sm:inline-block">
          ⌘K
        </kbd>
      </div>
      <div className="flex items-center gap-3">
        <Moon className="h-4 w-4 text-muted-foreground" />
        <Bell className="h-4 w-4 text-muted-foreground" />
        <div className="h-6 w-px bg-border" />
        <div className="hidden flex-col items-end md:flex">
          <span className="text-xs font-semibold leading-tight text-foreground">ProOps</span>
          <span className="text-[10px] leading-tight text-muted-foreground">Plano Pro</span>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-primary/10 text-xs font-bold text-primary">
          P
        </div>
      </div>
    </div>
  );
}

/** Dock — réplica do BottomDock real (navegação do app, Dashboard ativo) */
const DOCK_ITEMS = [
  { icon: LayoutDashboard, active: true },
  { icon: FilePenLine, active: false },
  { icon: ReceiptText, active: false },
  { icon: Contact, active: false },
  { icon: CalendarDays, active: false },
  { icon: Package2, active: false },
  { icon: Wrench, active: false },
];

export function HeroAppDock() {
  return (
    <div className="flex items-center gap-1 rounded-2xl border border-border/60 bg-background/90 px-2 py-1.5 shadow-lg backdrop-blur-md">
      {DOCK_ITEMS.map(({ icon: Icon, active }, i) => (
        <div
          key={i}
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            active
              ? "bg-primary/20 ring-1 ring-primary/35 shadow-sm dark:bg-primary/25 dark:ring-primary/25"
              : ""
          }`}
        >
          <Icon className="h-5 w-5 text-foreground/85" />
        </div>
      ))}
      <div className="mx-1 h-6 w-px bg-black/10 dark:bg-white/15" />
      <div className="flex h-10 w-10 items-center justify-center rounded-xl">
        <LogOut className="h-5 w-5 text-foreground/85" />
      </div>
    </div>
  );
}

/** Header do dashboard — réplica fiel (saudação + Saldo Atual, com border-b) */
export function HeroDashboardHeader() {
  return (
    <div className="flex flex-col justify-between gap-3 border-b border-border/60 px-1 pb-3 sm:flex-row sm:items-center">
      <div>
        <h3 className="inline-flex items-center gap-1.5 whitespace-nowrap text-xl font-bold tracking-tight sm:text-2xl">
          <span className="bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
            Bom dia, ProOps!
          </span>
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
