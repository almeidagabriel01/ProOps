"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CalendarDays } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { getGreeting } from "@/utils/format";
import { useDashboardData } from "@/hooks/useDashboardData";
import { SimpleBarChart } from "@/components/charts/simple-bar-chart";
import {
  FinancialMetricCards,
  AlertsCard,
  RecentTransactionsList,
  RecentProposalsList,
  QuickActionsCard,
  ProposalStatsCard,
  ClientsStatsCard,
  WalletsGrid, // Import WalletsGrid
  MonthStats, // Import MonthStats
} from "./_components";
import { DashboardSkeleton } from "./_components/dashboard-skeleton";

import { useTenant } from "@/providers/tenant-provider";

export default function DashboardPage() {
  const { user } = useAuth();
  const { tenantOwner } = useTenant();
  const {
    financialSummary,
    clients,
    chartData,
    proposalStats,
    overdueTransactions,
    upcomingDue,
    newClientsThisMonth,
    recentTransactions,
    recentProposals,
    balance,
    wallets,
    currentMonthStats,
    isLoading,
  } = useDashboardData();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="bg-linear-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
              {getGreeting()}, {tenantOwner?.name || user?.name || "Usuário"}!
            </span>{" "}
            <span className="text-foreground">👋</span>
          </h1>
          <p className="text-muted-foreground mt-2 flex items-center gap-2 text-sm">
            <CalendarDays className="w-4 h-4" />
            {new Date().toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <QuickActionsCard />

      {/* Financial Summary */}
      <FinancialMetricCards
        financialSummary={financialSummary}
        balance={balance}
      />

      {/* Alerts */}
      <AlertsCard
        overdueCount={overdueTransactions.length}
        upcomingDueCount={upcomingDue.length}
      />

      {/* Wallets Grid - NEW */}
      <WalletsGrid wallets={wallets} />

      {/* Charts & Monthly Breakdown */}
      <div className="grid lg:grid-cols-7 gap-6">
        {/* Fluxo de Caixa (Chart) */}
        <Card className="lg:col-span-4 flex flex-col shadow-md bg-linear-to-br from-background to-slate-50/30 dark:to-slate-950/10 border border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Fluxo de Caixa</CardTitle>
                <CardDescription>
                  Receitas vs Despesas nos últimos 6 meses
                </CardDescription>
              </div>
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm" />
                  <span className="text-muted-foreground font-medium">
                    Receitas
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500 shadow-sm" />
                  <span className="text-muted-foreground font-medium">
                    Despesas
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0 pb-4 min-h-[300px]">
            <SimpleBarChart data={chartData} />
          </CardContent>
        </Card>

        {/* Monthly Stats - NEW */}
        <div className="lg:col-span-3 space-y-6 flex flex-col justify-center h-full">
          <MonthStats currentMonthStats={currentMonthStats} />
        </div>
      </div>

      {/* Other Stats */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="flex-1">
          <ProposalStatsCard stats={proposalStats} />
        </div>
        <div className="flex-1">
          <ClientsStatsCard
            totalClients={clients.length}
            newClientsThisMonth={newClientsThisMonth}
          />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid md:grid-cols-2 gap-6 h-full">
        <RecentTransactionsList transactions={recentTransactions} />
        <RecentProposalsList proposals={recentProposals} />
      </div>
    </div>
  );
}
