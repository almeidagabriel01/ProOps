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
} from "./_components";
import { DashboardSkeleton } from "./_components/dashboard-skeleton";

export default function DashboardPage() {
  const { user } = useAuth();
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
    isLoading,
  } = useDashboardData();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {getGreeting()}, {user?.name || "Usuário"}! 👋
          </h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
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

      {/* Financial Summary Cards */}
      <FinancialMetricCards
        financialSummary={financialSummary}
        balance={balance}
      />

      {/* Alerts */}
      <AlertsCard
        overdueCount={overdueTransactions.length}
        upcomingDueCount={upcomingDue.length}
      />

      {/* Chart + Stats */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Fluxo de Caixa</CardTitle>
                <CardDescription>
                  Receitas vs Despesas nos últimos 6 meses
                </CardDescription>
              </div>
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-muted-foreground">Receitas</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  <span className="text-muted-foreground">Despesas</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <SimpleBarChart data={chartData} />
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="space-y-4">
          <ProposalStatsCard stats={proposalStats} />
          <ClientsStatsCard
            totalClients={clients.length}
            newClientsThisMonth={newClientsThisMonth}
          />
        </div>
      </div>

      {/* Quick Actions */}
      <QuickActionsCard />

      {/* Recent Activity */}
      <div className="grid md:grid-cols-2 gap-6">
        <RecentTransactionsList transactions={recentTransactions} />
        <RecentProposalsList proposals={recentProposals} />
      </div>
    </div>
  );
}
