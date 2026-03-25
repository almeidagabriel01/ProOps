"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CalendarDays, Wallet } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { getGreeting, formatCurrency } from "@/utils/format";
import { formatDateBR } from "@/utils/date-format";
import { useDashboardData } from "@/hooks/useDashboardData";
import { SimpleBarChart } from "@/components/charts/simple-bar-chart";
import {
  AlertsCard,
  RecentTransactionsList,
  RecentProposalsList,
  QuickActionsCard,
  ProposalStatsCard,
  ClientsStatsCard,
  MonthStats,
  FutureBalanceChart,
} from "./_components";
import { DashboardSkeleton } from "./_components/dashboard-skeleton";

import { useTenant } from "@/providers/tenant-provider";
import { SelectTenantState } from "@/components/shared/select-tenant-state";

export default function DashboardPage() {
  const { user } = useAuth();
  const { tenantOwner, tenant } = useTenant();
  const {
    clients,
    chartData,
    futureBalances,
    proposalStats,
    overdueTransactions,
    upcomingDue,
    newClientsThisMonth,
    recentTransactions,
    recentProposals,
    balance,
    currentMonthStats,
    isLoading,
  } = useDashboardData();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!tenant && user?.role === "superadmin") {
    return <SelectTenantState />;
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
              {getGreeting()}, {tenantOwner?.name || user?.name || "Usuário"}!
            </span>{" "}
            <span className="text-foreground">👋</span>
          </h1>
          <p className="text-muted-foreground mt-2 flex items-center gap-2 text-sm">
            <CalendarDays className="w-4 h-4" />
            {formatDateBR(new Date())}
          </p>
        </div>

        <div className="flex items-center gap-4 md:gap-8">
          <div className="text-center md:text-right mt-2 md:mt-0">
            <div className="flex items-center gap-2 text-muted-foreground mb-1 justify-center md:justify-end">
              <Wallet className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wide">
                Saldo Atual
              </span>
            </div>
            <div
              className={`text-2xl font-bold tracking-tight ${balance >= 0 ? "text-emerald-500" : "text-rose-500"}`}
            >
              {formatCurrency(balance)}
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      <AlertsCard
        overdueCount={overdueTransactions.length}
        upcomingDueCount={upcomingDue.length}
      />

      {/* Quick Actions */}
      <QuickActionsCard />

      {/* Charts (Fluxo de Caixa & Balanço Futuro) */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Fluxo de Caixa (Chart) */}
        <Card className="flex flex-col shadow-md bg-gradient-to-br from-background to-slate-50/30 dark:to-slate-950/10 border border-border/50 h-full">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Fluxo de Caixa</CardTitle>
                <CardDescription>
                  Receitas vs Despesas dos próximos 6 meses
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

        {/* Future Balances (Chart) - NEW */}
        <FutureBalanceChart data={futureBalances} />
      </div>

      {/* Recents & Walkthroughs */}
      <div className="grid lg:grid-cols-2 gap-6">
        <RecentProposalsList proposals={recentProposals} />
        <MonthStats currentMonthStats={currentMonthStats} />
      </div>

      {/* Stats row */}
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

      {/* Recent Activity (Remaining) */}
      <div className="grid gap-6">
        <RecentTransactionsList transactions={recentTransactions} />
      </div>
    </div>
  );
}
