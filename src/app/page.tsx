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
  Plus,
  AlertCircle,
  Package,
  ArrowUpCircle,
  ArrowDownCircle,
  CalendarDays,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  TransactionService,
  Transaction,
} from "@/services/transaction-service";
import { ProposalService, Proposal } from "@/services/proposal-service";
import { ClientService, Client } from "@/services/client-service";
import { useTenant } from "@/providers/tenant-provider";
import { useAuth } from "@/providers/auth-provider";

// Helper to get greeting based on time
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
};

// Format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

// Format date
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
};

export default function DashboardPage() {
  const { tenant } = useTenant();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = React.useState(true);

  // Data states
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [proposals, setProposals] = React.useState<Proposal[]>([]);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [financialSummary, setFinancialSummary] = React.useState({
    totalIncome: 0,
    totalExpense: 0,
    pendingIncome: 0,
    pendingExpense: 0,
  });

  React.useEffect(() => {
    const fetchData = async () => {
      if (!tenant) return;

      try {
        const [transactionsData, proposalsData, clientsData, summary] =
          await Promise.all([
            TransactionService.getTransactions(tenant.id),
            ProposalService.getProposals(tenant.id),
            ClientService.getClients(tenant.id),
            TransactionService.getSummary(tenant.id),
          ]);

        setTransactions(transactionsData);
        setProposals(proposalsData);
        setClients(clientsData);
        setFinancialSummary(summary);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [tenant]);

  // Calculate monthly data for chart (last 6 months)
  const chartData = React.useMemo(() => {
    const months: {
      [key: string]: { receitas: number; despesas: number; name: string };
    } = {};
    const now = new Date();

    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      months[key] = {
        name: date.toLocaleDateString("pt-BR", { month: "short" }),
        receitas: 0,
        despesas: 0,
      };
    }

    // Aggregate transactions
    transactions.forEach((t) => {
      if (t.status !== "paid") return;
      const date = new Date(t.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (months[key]) {
        if (t.type === "income") {
          months[key].receitas += t.amount;
        } else {
          months[key].despesas += t.amount;
        }
      }
    });

    return Object.values(months);
  }, [transactions]);

  // Proposal stats
  const proposalStats = React.useMemo(() => {
    const approved = proposals.filter((p) => p.status === "approved").length;
    const pending = proposals.filter(
      (p) => p.status === "sent" || p.status === "draft"
    ).length;
    const rejected = proposals.filter((p) => p.status === "rejected").length;
    const total = proposals.length;
    const conversionRate = total > 0 ? Math.round((approved / total) * 100) : 0;

    return { approved, pending, rejected, total, conversionRate };
  }, [proposals]);

  // Recent items
  const recentTransactions = transactions.slice(0, 5);
  const recentProposals = proposals.slice(0, 5);

  // Alerts
  const overdueTransactions = transactions.filter(
    (t) => t.status === "overdue"
  );
  const upcomingDue = transactions.filter((t) => {
    if (t.status !== "pending" || !t.dueDate) return false;
    const dueDate = new Date(t.dueDate);
    const today = new Date();
    const diffDays = Math.ceil(
      (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    return diffDays >= 0 && diffDays <= 7;
  });

  // New clients this month
  const newClientsThisMonth = clients.filter((c) => {
    const created = new Date(c.createdAt);
    const now = new Date();
    return (
      created.getMonth() === now.getMonth() &&
      created.getFullYear() === now.getFullYear()
    );
  }).length;

  // Balance
  const balance = financialSummary.totalIncome - financialSummary.totalExpense;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">
          Carregando dashboard...
        </div>
      </div>
    );
  }

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
        <Card
          className={balance >= 0 ? "border-green-500/30" : "border-red-500/30"}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Atual</CardTitle>
            <Wallet
              className={`h-4 w-4 ${balance >= 0 ? "text-green-500" : "text-red-500"}`}
            />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${balance >= 0 ? "text-green-500" : "text-red-500"}`}
            >
              {formatCurrency(balance)}
            </div>
            <p className="text-xs text-muted-foreground">
              Receitas - Despesas pagas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receitas</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {formatCurrency(financialSummary.totalIncome)}
            </div>
            <p className="text-xs text-muted-foreground">Total recebido</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Despesas</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {formatCurrency(financialSummary.totalExpense)}
            </div>
            <p className="text-xs text-muted-foreground">Total pago</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendências</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">
              {formatCurrency(
                financialSummary.pendingIncome + financialSummary.pendingExpense
              )}
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
        {/* Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Fluxo de Caixa</CardTitle>
            <CardDescription>
              Receitas vs Despesas nos últimos 6 meses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis
                    className="text-xs"
                    tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="receitas"
                    name="Receitas"
                    fill="#22c55e"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="despesas"
                    name="Despesas"
                    fill="#ef4444"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
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
                <span className="text-muted-foreground text-sm">
                  Taxa de conversão
                </span>
                <span className="font-bold text-primary">
                  {proposalStats.conversionRate}%
                </span>
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
                <span className="text-muted-foreground text-sm">
                  Novos este mês
                </span>
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
              <Button
                variant="outline"
                className="w-full h-auto py-4 flex flex-col gap-2"
              >
                <FileText className="w-5 h-5 text-primary" />
                <span className="text-sm">Nova Proposta</span>
              </Button>
            </Link>
            <Link href="/financial/new">
              <Button
                variant="outline"
                className="w-full h-auto py-4 flex flex-col gap-2"
              >
                <Wallet className="w-5 h-5 text-primary" />
                <span className="text-sm">Novo Lançamento</span>
              </Button>
            </Link>
            <Link href="/customers/new">
              <Button
                variant="outline"
                className="w-full h-auto py-4 flex flex-col gap-2"
              >
                <Users className="w-5 h-5 text-primary" />
                <span className="text-sm">Novo Cliente</span>
              </Button>
            </Link>
            <Link href="/products/new">
              <Button
                variant="outline"
                className="w-full h-auto py-4 flex flex-col gap-2"
              >
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
                      <div
                        className={`p-1.5 rounded-full ${
                          t.type === "income"
                            ? "bg-green-500/10"
                            : "bg-red-500/10"
                        }`}
                      >
                        {t.type === "income" ? (
                          <ArrowUpCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <ArrowDownCircle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium truncate max-w-[150px]">
                          {t.description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(t.date)}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        t.type === "income" ? "text-green-500" : "text-red-500"
                      }`}
                    >
                      {t.type === "income" ? "+" : "-"}
                      {formatCurrency(t.amount)}
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
                        <p className="text-sm font-medium truncate max-w-[150px]">
                          {p.clientName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(p.createdAt)}
                        </p>
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
                      {p.status === "approved"
                        ? "Aprovada"
                        : p.status === "rejected"
                          ? "Recusada"
                          : "Pendente"}
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
