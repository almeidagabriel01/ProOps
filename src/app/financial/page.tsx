"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Transaction,
  TransactionService,
  TransactionType,
  TransactionStatus,
} from "@/services/transaction-service";
import { useTenant } from "@/providers/tenant-provider";
import {
  Plus,
  Wallet,
  Trash2,
  Edit,
  Search,
  Loader2,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowUpCircle,
  ArrowDownCircle,
} from "lucide-react";

const typeConfig: Record<
  TransactionType,
  { label: string; icon: React.ElementType; color: string }
> = {
  income: { label: "Receita", icon: ArrowUpCircle, color: "text-green-500" },
  expense: { label: "Despesa", icon: ArrowDownCircle, color: "text-red-500" },
};

const statusConfig: Record<
  TransactionStatus,
  {
    label: string;
    variant: "default" | "destructive" | "outline" | "success" | "warning";
  }
> = {
  paid: { label: "Pago", variant: "success" },
  pending: { label: "Pendente", variant: "warning" },
  overdue: { label: "Atrasado", variant: "destructive" },
};

export default function FinancialPage() {
  const { tenant } = useTenant();
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [filterType, setFilterType] = React.useState<TransactionType | "all">(
    "all"
  );
  const [summary, setSummary] = React.useState({
    totalIncome: 0,
    totalExpense: 0,
    pendingIncome: 0,
    pendingExpense: 0,
  });

  React.useEffect(() => {
    const fetchData = async () => {
      if (tenant) {
        try {
          const [data, summaryData] = await Promise.all([
            TransactionService.getTransactions(tenant.id),
            TransactionService.getSummary(tenant.id),
          ]);
          setTransactions(data);
          setSummary(summaryData);
        } catch (error) {
          console.error("Failed to fetch transactions", error);
        }
      }
      setIsLoading(false);
    };
    fetchData();
  }, [tenant]);

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este lançamento?")) {
      try {
        await TransactionService.deleteTransaction(id);
        setTransactions((prev) => prev.filter((t) => t.id !== id));
        // Refresh summary
        if (tenant) {
          const summaryData = await TransactionService.getSummary(tenant.id);
          setSummary(summaryData);
        }
      } catch (error) {
        console.error("Error deleting transaction:", error);
        alert("Erro ao excluir lançamento");
      }
    }
  };

  const filteredTransactions = React.useMemo(() => {
    let filtered = transactions;

    if (filterType !== "all") {
      filtered = filtered.filter((t) => t.type === filterType);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.description.toLowerCase().includes(term) ||
          t.clientName?.toLowerCase().includes(term) ||
          t.category?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [transactions, searchTerm, filterType]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Balance */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financeiro</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie receitas e despesas
          </p>
        </div>

        {/* Balance in Header */}
        <div className="flex items-center gap-4 md:gap-8">
          <div className="text-center md:text-right">
            <div className="flex items-center gap-2 text-muted-foreground mb-1 justify-center md:justify-end">
              <Wallet className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wide">
                Saldo
              </span>
            </div>
            <div
              className={`text-2xl md:text-2xl font-bold ${
                summary.totalIncome - summary.totalExpense >= 0
                  ? "text-green-500"
                  : "text-red-500"
              }`}
            >
              {formatCurrency(summary.totalIncome - summary.totalExpense)}
            </div>
          </div>

          <Link href="/financial/new">
            <Button size="lg" className="gap-2">
              <Plus className="w-5 h-5" />
              Novo Lançamento
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Receitas Pagas
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {formatCurrency(summary.totalIncome)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Despesas Pagas
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {formatCurrency(summary.totalExpense)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">A Receber</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">
              {formatCurrency(summary.pendingIncome)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">A Pagar</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">
              {formatCurrency(summary.pendingExpense)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição, cliente ou categoria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={filterType === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType("all")}
          >
            Todos
          </Button>
          <Button
            variant={filterType === "income" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType("income")}
            className="gap-1"
          >
            <ArrowUpCircle className="w-4 h-4" />
            Receitas
          </Button>
          <Button
            variant={filterType === "expense" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType("expense")}
            className="gap-1"
          >
            <ArrowDownCircle className="w-4 h-4" />
            Despesas
          </Button>
        </div>
      </div>

      {/* Transactions List */}
      {transactions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Wallet className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              Nenhum lançamento encontrado
            </h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Comece a registrar suas receitas e despesas.
            </p>
            <Link href="/financial/new">
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Criar Primeiro Lançamento
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : filteredTransactions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Nenhum resultado encontrado
            </h3>
            <p className="text-muted-foreground text-center">
              Tente buscar por outro termo ou remova os filtros.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredTransactions.map((transaction) => {
            const typeInfo = typeConfig[transaction.type];
            const statusInfo = statusConfig[transaction.status];
            const TypeIcon = typeInfo.icon;

            return (
              <Card
                key={transaction.id}
                className="hover:bg-muted/50 transition-colors"
              >
                <CardContent className="flex items-center gap-4 py-4 px-4">
                  <div
                    className={`p-2 rounded-full bg-muted ${typeInfo.color}`}
                  >
                    <TypeIcon className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {transaction.description}
                      </span>
                      {transaction.category && (
                        <Badge variant="outline" className="text-xs">
                          {transaction.category}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                      <span>{formatDate(transaction.date)}</span>
                      {transaction.wallet && (
                        <>
                          <span>•</span>
                          <span>{transaction.wallet}</span>
                        </>
                      )}
                      {transaction.isInstallment && (
                        <>
                          <span>•</span>
                          <span className="text-primary">
                            {transaction.installmentNumber}/
                            {transaction.installmentCount}x
                          </span>
                        </>
                      )}
                      {transaction.clientName && (
                        <>
                          <span>•</span>
                          <span>{transaction.clientName}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`font-bold ${typeInfo.color}`}>
                      {transaction.type === "expense" ? "-" : "+"}
                      {formatCurrency(transaction.amount)}
                    </div>
                    <Badge variant={statusInfo.variant} className="text-xs">
                      {statusInfo.label}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1">
                    <Link href={`/financial/${transaction.id}`}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(transaction.id)}
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
