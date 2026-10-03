"use client";

import * as React from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CalendarDays, Wallet } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { getGreeting, formatCurrency, resolveGreetingName } from "@/utils/format";
import { formatDateBR } from "@/utils/date-format";
import { useDashboardData } from "@/hooks/useDashboardData";
import {
  AlertsCard,
  RecentTransactionsList,
  RecentProposalsList,
  QuickActionsCard,
  MonthStats,
  CommissionsPanel,
} from "./_components";
import dynamic from "next/dynamic";

// Os gráficos (Recharts) carregam depois do resto do dashboard. Os
// placeholders ocupam o mesmo espaço, então nada pula quando eles chegam.
const SimpleBarChart = dynamic(
  () => import("@/components/charts/simple-bar-chart").then((m) => m.SimpleBarChart),
  { ssr: false, loading: () => <div className="h-full w-full min-h-[200px]" /> },
);
const FutureBalanceChart = dynamic(
  () => import("./_components/future-balance-chart").then((m) => m.FutureBalanceChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-full min-h-[380px] rounded-xl border border-border/50 bg-card animate-pulse" />
    ),
  },
);
import { DashboardSkeleton } from "./_components/dashboard-skeleton";
import { MonthSwitcher } from "./_components/month-switcher";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMonthLabel } from "@/lib/month-key";

import { useTenant } from "@/providers/tenant-provider";
import { getNicheConfig } from "@/lib/niches/config";
import { usePermissions } from "@/providers/permissions-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { SelectTenantState } from "@/components/shared/select-tenant-state";
import { FirstStepsCard } from "@/components/onboarding/first-steps-card";
import { MyTasksCard } from "@/components/features/tasks/my-tasks-card";
import { GoalsProgressCard } from "@/components/features/sales-goals/goals-progress-card";
import { MyCommissionsCard } from "@/components/features/sales-goals/my-commissions-card";
import { usePagePermission } from "@/hooks/usePagePermission";
import { useProposalAttention, useSalesSummary } from "@/hooks/use-dashboard-sales";
import { canSeeCompanySales } from "@/lib/sales/dashboard-sales";
import { SalesSummaryCard } from "./_components/sales-summary-card";
import { ProposalAttentionCard } from "./_components/proposal-attention-card";

export default function DashboardPage() {
  const { user } = useAuth();
  const { tenantOwner, tenant } = useTenant();
  const {
    chartData,
    futureBalances,
    proposalStats,
    overdueTransactions,
    overdueAmount,
    upcomingDue,
    upcomingDueAmount,
    recentTransactions,
    recentProposals,
    balance,
    currentMonthStats,
    commissionReport,
    selectedMonth,
    setSelectedMonth,
    isCurrentMonth,
    openProposalStatuses,
    loading,
    isLoading,
  } = useDashboardData();
  const { isLoading: planLoading } = usePlanLimits();
  const { isLoading: permissionsLoading, isMaster, isDemo } = usePermissions();
  const { canView: canViewProposals } = usePagePermission("proposals");
  const showSales = canSeeCompanySales({ canViewProposals, isMaster, isDemo });
  const sales = useSalesSummary(
    tenant?.id,
    selectedMonth,
    openProposalStatuses,
    showSales && !isDemo,
  );
  const attention = useProposalAttention(
    tenant?.id,
    openProposalStatuses,
    canViewProposals && !isDemo,
  );
  const [tasksLoading, setTasksLoading] = React.useState(true);
  const [waitedEnough, setWaitedEnough] = React.useState(false);

  // A parte de cima (saldo, alertas, ações rápidas, tarefas e gráficos) aparece
  // de uma vez, como antes dos blocos independentes: cada um que chegava
  // sozinho mudava de tamanho ou sumia (o "carregando" dos alertas e das
  // tarefas some quando não há nada) e empurrava os vizinhos, e o CLS do
  // Dashboard passou de 0,1 no CI. A página fica montada e escondida por baixo
  // do esqueleto, para as tarefas já carregarem; o que fica abaixo da dobra
  // continua chegando por bloco. Os 6s são a saída se algo nunca responder.
  React.useEffect(() => {
    const timer = window.setTimeout(() => setWaitedEnough(true), 6000);
    return () => window.clearTimeout(timer);
  }, []);
  const topReady =
    waitedEnough || (!loading.finance && !planLoading && !permissionsLoading && !tasksLoading);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const monthLabel = formatMonthLabel(selectedMonth).toLocaleLowerCase("pt-BR");
  const period = isCurrentMonth
    ? { of: "deste mês", in: "neste mês" }
    : { of: `de ${monthLabel}`, in: `em ${monthLabel}` };

  if (!tenant && user?.role === "superadmin") {
    return <SelectTenantState />;
  }

  return (
    <>
    {!topReady && <DashboardSkeleton />}
    <div
      hidden={!topReady}
      className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
              {getGreeting()}, {resolveGreetingName(user?.name, tenantOwner?.name)}!
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
            {loading.finance ? (
              <Skeleton className="h-8 w-36 md:ml-auto" />
            ) : (
              <div
                className={`text-2xl font-bold tracking-tight ${balance >= 0 ? "text-emerald-500" : "text-rose-500"}`}
              >
                {formatCurrency(balance)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Primeiros passos (conta nova, some quando tudo estiver feito) */}
      <FirstStepsCard />

      {/* Alertas e ações rápidas. No celular as ações vêm primeiro: são o que
          se usa todo dia, e os alertas empurravam os botões para baixo. */}
      <div className="flex flex-col gap-8">
        {loading.finance ? (
          <Skeleton className="h-24 w-full rounded-xl" />
        ) : (
          <AlertsCard
            overdueCount={overdueTransactions.length}
            overdueAmount={overdueAmount}
            upcomingDueCount={upcomingDue.length}
            upcomingDueAmount={upcomingDueAmount}
          />
        )}

        <div className="max-md:-order-1">
          <QuickActionsCard />
        </div>

        {/* Some quando não há tarefa atrasada nem para hoje. */}
        <MyTasksCard onLoadingChange={setTasksLoading} />
      </div>

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
            {loading.finance ? (
              <Skeleton className="mx-6 h-[260px]" />
            ) : (
              <SimpleBarChart data={chartData} />
            )}
          </CardContent>
        </Card>

        {/* Future Balances (Chart) - NEW */}
        {loading.finance ? (
          <Skeleton className="h-full min-h-[380px] rounded-xl" />
        ) : (
          <FutureBalanceChart data={futureBalances} />
        )}
      </div>

      {/* O mês escolhido: vendas, metas, comissões e o resumo de gastos seguem
          o seletor daqui. Os gráficos acima são projeção, não dependem dele. */}
      <section className="space-y-6" aria-labelledby="dashboard-month-title">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <h2 id="dashboard-month-title" className="text-lg font-semibold tracking-tight">
            Resultado do mês
          </h2>
          <MonthSwitcher
            month={selectedMonth}
            isCurrentMonth={isCurrentMonth}
            onChange={setSelectedMonth}
          />
        </div>

        {showSales && (
          <SalesSummaryCard
            month={selectedMonth}
            summary={sales.summary}
            conversionRate={proposalStats.conversionRate}
            loading={sales.loading || loading.proposals}
            isDemo={isDemo}
          />
        )}

        {/* Em linhas, e não em colunas: cada linha tem a altura do maior
            card dela, então não sobra vão fora dos cards. Com colunas, uma
            meta curta ao lado dos dois cards de resumo deixava um buraco
            embaixo, e colunas balanceadas só diminuíam o buraco.
            Linha 1: Metas, Comissões e Minhas comissões (somem sem dado;
            sobrando uma, ela ocupa a largura toda; sem nenhuma, a linha some
            pelo :empty).
            Linha 2: Despesas por categoria e Carteiras. */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="grid gap-6 empty:hidden lg:col-span-2 lg:grid-cols-2 lg:[&:has(>:only-child)]:grid-cols-1">
            <GoalsProgressCard month={selectedMonth} />
            {!loading.month && <CommissionsPanel report={commissionReport} />}
            <MyCommissionsCard month={selectedMonth} />
          </div>
          {loading.month ? (
            <>
              <Skeleton className="h-64 rounded-xl" />
              <Skeleton className="h-64 rounded-xl" />
            </>
          ) : (
            <MonthStats
              currentMonthStats={currentMonthStats}
              period={period}
              cardClassName="flex flex-col"
            />
          )}
        </div>
      </section>

      {/* Propostas: o que pede ação agora e as mais recentes. */}
      {canViewProposals && (
        <div className="grid gap-6 lg:grid-cols-2">
          <ProposalAttentionCard
            result={attention.result}
            loading={attention.loading || loading.proposals}
            isDemo={isDemo}
            demoExample={getNicheConfig(tenant?.niche).demoAttention}
          />
          {loading.proposals ? (
            <Skeleton className="h-80 rounded-xl" />
          ) : (
            <RecentProposalsList proposals={recentProposals} />
          )}
        </div>
      )}

      {/* Recent Activity (Remaining) */}
      <div className="grid gap-6">
        {loading.finance ? (
          <Skeleton className="h-72 rounded-xl" />
        ) : (
          <RecentTransactionsList transactions={recentTransactions} />
        )}
      </div>
    </div>
    </>
  );
}
