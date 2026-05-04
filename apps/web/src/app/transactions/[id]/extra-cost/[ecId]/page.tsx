"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TransactionService,
  Transaction,
  TransactionStatus,
} from "@/services/transaction-service";
import { ArrowLeft, Wallet, ArrowUpCircle, ArrowDownCircle, Calendar, CreditCard, FileText, Link2 } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/utils/format";
import { formatDateBR, formatDateTimeBR } from "@/utils/date-format";
import { Loader } from "@/components/ui/loader";

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

const formatDate = (dateString?: string) => {
  return formatDateBR(dateString, "—");
};

export default function ViewExtraCostPage() {
  const router = useRouter();
  const params = useParams();
  const parentId = params.id as string;
  const ecId = params.ecId as string;

  const [isLoading, setIsLoading] = React.useState(true);
  const [parentTransaction, setParentTransaction] =
    React.useState<Transaction | null>(null);

  React.useEffect(() => {
    if (!parentId) return;
    TransactionService.getTransactionById(parentId)
      .then((data) => {
        setParentTransaction(data ?? null);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [parentId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader size="lg" />
      </div>
    );
  }

  const extraCost = parentTransaction?.extraCosts?.find((ec) => ec.id === ecId);

  if (!parentTransaction || !extraCost) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">
          Acréscimo/Custo Extra não encontrado
        </p>
        <Button variant="outline" onClick={() => router.push("/transactions")}>
          Voltar para Financeiro
        </Button>
      </div>
    );
  }

  const isIncome = parentTransaction.type === "income";
  const label = isIncome ? "Acréscimo" : "Custo Extra";
  const TypeIcon = isIncome ? ArrowUpCircle : ArrowDownCircle;
  const typeColor = isIncome ? "text-green-500" : "text-red-500";

  const ecStatus: TransactionStatus = extraCost.status || "pending";
  const statusInfo = statusConfig[ecStatus];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/transactions")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Detalhes do {label}
            </h1>
            <p className="text-muted-foreground text-sm">
              Vinculado ao lançamento:{" "}
              <span className="font-medium text-foreground">
                {parentTransaction.description}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Main Info Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-full bg-muted ${typeColor}`}>
              <TypeIcon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-semibold">
                  {extraCost.description || label}
                </h2>
                <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                <Badge
                  variant="outline"
                  className="border-amber-400 text-amber-600 dark:text-amber-400"
                >
                  {label}
                </Badge>
              </div>
              <p className={`text-3xl font-bold ${typeColor}`}>
                {isIncome ? "+" : "-"}
                {formatCurrency(extraCost.amount)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Creation date */}
        {extraCost.createdAt && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Data de Criação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">
                {formatDate(extraCost.createdAt)}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Wallet */}
        {(extraCost.wallet || parentTransaction.wallet) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Carteira
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">
                {extraCost.wallet || parentTransaction.wallet}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Parent due date */}
        {parentTransaction.dueDate && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Vencimento do Lançamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">
                {formatDate(parentTransaction.dueDate)}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Parent amount for context */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Valor do Lançamento Principal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {formatCurrency(parentTransaction.amount)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Link to parent transaction */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            Lançamento Vinculado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{parentTransaction.description}</p>
              <p className="text-sm text-muted-foreground">
                {formatCurrency(parentTransaction.amount)} ·{" "}
                {parentTransaction.type === "income" ? "Receita" : "Despesa"} ·{" "}
                {formatDate(
                  parentTransaction.dueDate || parentTransaction.date,
                )}
              </p>
            </div>
            <Link href={`/transactions/${parentId}/view`}>
              <Button variant="outline" size="sm" className="gap-2 shrink-0">
                <FileText className="w-4 h-4" />
                Ver Lançamento
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Metadata */}
      {extraCost.createdAt && (
        <div className="text-xs text-muted-foreground text-center">
          Criado em {formatDateTimeBR(extraCost.createdAt)}
        </div>
      )}
    </div>
  );
}
