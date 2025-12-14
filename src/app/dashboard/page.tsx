"use client";

import * as React from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Wallet,
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  FileText,
  AlertCircle,
  Package,
  ArrowUpCircle,
  ArrowDownCircle,
  CalendarDays,
} from "lucide-react";
import {
  TransactionService,
  Transaction,
} from "@/services/transaction-service";
import { ProposalService, Proposal } from "@/services/proposal-service";
import { ClientService, Client } from "@/services/client-service";
import { useTenant } from "@/providers/tenant-provider";
import { useAuth } from "@/providers/auth-provider";

// Static helpers - computed once at module load
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const formatCurrency = (value: number) => currencyFormatter.format(value);

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
};

// Lightweight CSS-based bar chart component
const SimpleBarChart = React.memo(({ data }: { data: { name: string; receitas: number; despesas: number }[] }) => {
  const maxValue = React.useMemo(() => {
    let max = 0;
    data.forEach(d => {
      if (d.receitas > max) max = d.receitas;
      if (d.despesas > max) max = d.despesas;
    });
    return max || 1;
  }, [data]);

  return (
    <div className="h-[280px] flex items-end gap-2 pt-8 pb-8 px-2">
      {data.map((item, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-2">
          <div className="w-full flex gap-1 items-end h-[200px]">
            {/* Receitas bar */}
            <div className="flex-1 flex flex-col justify-end">
              <div
                className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-md transition-all duration-500 relative group"
                style={{ height: `${(item.receitas / maxValue) * 100}%`, minHeight: item.receitas > 0 ? '4px' : '0' }}
              >
                {item.receitas > 0 && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-card border border-border px-2 py-1 rounded text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg z-10">
                    {formatCurrency(item.receitas)}
                  </div>
                )}
              </div>
            </div>
            {/* Despesas bar */}
            <div className="flex-1 flex flex-col justify-end">
              <div
                className="w-full bg-gradient-to-t from-rose-600 to-rose-400 rounded-t-md transition-all duration-500 relative group"
                style={{ height: `${(item.despesas / maxValue) * 100}%`, minHeight: item.despesas > 0 ? '4px' : '0' }}
              >
                {item.despesas > 0 && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-card border border-border px-2 py-1 rounded text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg z-10">
                    {formatCurrency(item.despesas)}
                  </div>
                )}
              </div>
            </div>
          </div>
          <span className="text-xs text-muted-foreground capitalize">{item.name}</span>
        </div>
      ))}
    </div>
  );
});
SimpleBarChart.displayName = "SimpleBarChart";

export default function DashboardPage() {
  const { tenant } = useTenant();
  const { user } = useAuth();

  // Single state object to reduce re-renders
  const [data, setData] = React.useState({
    transactions: [] as Transaction[],
    proposals: [] as Proposal[],
    clients: [] as Client[],
    financialSummary: {
      totalIncome: 0,
      totalExpense: 0,
      pendingIncome: 0,
      pendingExpense: 0,
    },
  });

  // Fetch all data once
  React.useEffect(() => {
    if (!tenant) return;

    let cancelled = false;

    const fetchData = async () => {
      try {
        const [transactions, proposals, clients, financialSummary] = await Promise.all([
          TransactionService.getTransactions(tenant.id),
          ProposalService.getProposals(tenant.id),
          ClientService.getClients(tenant.id),
          TransactionService.getSummary(tenant.id),
        ]);

        if (!cancelled) {
          setData({ transactions, proposals, clients, financialSummary });
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [tenant]);

  // Compute all derived values in a single useMemo
  const computed = React.useMemo(() => {
    const { transactions, proposals, clients, financialSummary } = data;
    const now = new Date();

    // Chart data
    const months: { [key: string]: { receitas: number; despesas: number; name: string } } = {};
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      months[key] = {
        name: date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        receitas: 0,
        despesas: 0,
      };
    }
    transactions.forEach((t) => {
      if (t.status !== "paid") return;
      const date = new Date(t.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (months[key]) {
        if (t.type === "income") months[key].receitas += t.amount;
        else months[key].despesas += t.amount;
      }
    });
    const chartData = Object.values(months);

    // Proposal stats
    const approved = proposals.filter((p) => p.status === "approved").length;
    const pending = proposals.filter((p) => p.status === "sent" || p.status === "draft").length;
    const total = proposals.length;
    const conversionRate = total > 0 ? Math.round((approved / total) * 100) : 0;

    // Alerts
    const overdueTransactions = transactions.filter((t) => t.status === "overdue");
    const upcomingDue = transactions.filter((t) => {
      if (t.status !== "pending" || !t.dueDate) return false;
      const dueDate = new Date(t.dueDate);
      const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 7;
    });

    // New clients
    const newClientsThisMonth = clients.filter((c) => {
      const created = new Date(c.createdAt);
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
    }).length;

    return {
      chartData,
      proposalStats: { approved, pending, total, conversionRate },
      overdueTransactions,
      upcomingDue,
      newClientsThisMonth,
      recentTransactions: transactions.slice(0, 5),
      recentProposals: proposals.slice(0, 5),
      balance: financialSummary.totalIncome - financialSummary.totalExpense,
    };
  }, [data]);

  const { transactions, proposals, clients, financialSummary } = data;
  const {
    chartData,
    proposalStats,
    overdueTransactions,
    upcomingDue,
    newClientsThisMonth,
    recentTransactions,
    recentProposals,
    balance,
  } = computed;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {getGreeting()}, {tenant?.name || "Usuário"}! 👋
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className={balance >= 0 ? "border-emerald-500/30" : "border-rose-500/30"}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Atual</CardTitle>
            <Wallet className={`h-4 w-4 ${balance >= 0 ? "text-emerald-500" : "text-rose-500"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balance >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {formatCurrency(balance)}
            </div>
            <p className="text-xs text-muted-foreground">Receitas - Despesas pagas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receitas</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">
              {formatCurrency(financialSummary.totalIncome)}
            </div>
            <p className="text-xs text-muted-foreground">Total recebido</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Despesas</CardTitle>
            <TrendingDown className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-500">
              {formatCurrency(financialSummary.totalExpense)}
            </div>
            <p className="text-xs text-muted-foreground">Total pago</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendências</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">
              {formatCurrency(financialSummary.pendingIncome + financialSummary.pendingExpense)}
            </div>
            <p className="text-xs text-muted-foreground">A receber + A pagar</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {(overdueTransactions.length > 0 || upcomingDue.length > 0) && (
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-orange-500">
              <AlertCircle className="w-4 h-4" />
              Alertas
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {overdueTransactions.length > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="w-3 h-3" />
                {overdueTransactions.length} pagamento(s) atrasado(s)
              </Badge>
            )}
            {upcomingDue.length > 0 && (
              <Badge variant="warning" className="gap-1">
                <Clock className="w-3 h-3" />
                {upcomingDue.length} vencendo em 7 dias
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      {/* Chart + Stats */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Chart - Lightweight CSS version */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Fluxo de Caixa</CardTitle>
                <CardDescription>Receitas vs Despesas nos últimos 6 meses</CardDescription>
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
          {/* Proposals */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Propostas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Total</span>
                <span className="font-bold">{proposalStats.total}</span>
              </div>
              <div className="flex gap-2">
                <Badge variant="success" className="flex-1 justify-center">
                  {proposalStats.approved} Aprovadas
                </Badge>
                <Badge variant="warning" className="flex-1 justify-center">
                  {proposalStats.pending} Pendentes
                </Badge>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-muted-foreground text-sm">Taxa de conversão</span>
                <span className="font-bold text-primary">{proposalStats.conversionRate}%</span>
              </div>
            </CardContent>
          </Card>

          {/* Clients */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4" />
                Clientes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Total</span>
                <span className="font-bold">{clients.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Novos este mês</span>
                <Badge variant="outline">{newClientsThisMonth}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Ações Rápidas</CardTitle>
          <CardDescription>Atalhos para tarefas comuns</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link href="/proposals/new">
              <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <span className="text-sm">Nova Proposta</span>
              </Button>
            </Link>
            <Link href="/financial/new">
              <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
                <Wallet className="w-5 h-5 text-primary" />
                <span className="text-sm">Novo Lançamento</span>
              </Button>
            </Link>
            <Link href="/customers/new">
              <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
                <Users className="w-5 h-5 text-primary" />
                <span className="text-sm">Novo Cliente</span>
              </Button>
            </Link>
            <Link href="/products/new">
              <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
                <Package className="w-5 h-5 text-primary" />
                <span className="text-sm">Novo Produto</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Últimas Transações</CardTitle>
              <CardDescription>5 lançamentos mais recentes</CardDescription>
            </div>
            <Link href="/financial">
              <Button variant="ghost" size="sm" className="gap-1">
                Ver todos <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentTransactions.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">
                Nenhuma transação ainda
              </p>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((t) => (
                  <div key={t.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-full ${t.type === "income" ? "bg-emerald-500/10" : "bg-rose-500/10"}`}>
                        {t.type === "income" ? (
                          <ArrowUpCircle className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <ArrowDownCircle className="w-4 h-4 text-rose-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium truncate max-w-[150px]">{t.description}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-medium ${t.type === "income" ? "text-emerald-500" : "text-rose-500"}`}>
                      {t.type === "income" ? "+" : "-"}{formatCurrency(t.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Proposals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Últimas Propostas</CardTitle>
              <CardDescription>5 propostas mais recentes</CardDescription>
            </div>
            <Link href="/proposals">
              <Button variant="ghost" size="sm" className="gap-1">
                Ver todas <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentProposals.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">
                Nenhuma proposta ainda
              </p>
            ) : (
              <div className="space-y-3">
                {recentProposals.map((p) => (
                  <div key={p.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-full bg-primary/10">
                        <FileText className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium truncate max-w-[150px]">{p.clientName}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(p.createdAt)}</p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        p.status === "approved"
                          ? "success"
                          : p.status === "rejected"
                            ? "destructive"
                            : "warning"
                      }
                    >
                      {p.status === "approved" ? "Aprovada" : p.status === "rejected" ? "Recusada" : "Pendente"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}