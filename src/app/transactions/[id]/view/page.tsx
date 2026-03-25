"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TransactionService,
  Transaction,
  TransactionType,
  TransactionStatus,
} from "@/services/transaction-service";
import { usePagePermission } from "@/hooks/usePagePermission";
import {
  ArrowLeft,
  Loader2,
  Edit,
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  Calendar,
  User,
  CreditCard,
  FileText,
  Clock,
} from "lucide-react";
import { formatDateBR, formatDateTimeBR } from "@/utils/date-format";

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

export default function ViewTransactionPage() {
  const router = useRouter();
  const params = useParams();
  const transactionId = params.id as string;
  const { canEdit } = usePagePermission("financial");

  const [isLoading, setIsLoading] = React.useState(true);
  const [transaction, setTransaction] = React.useState<Transaction | null>(
    null,
  );
  const [relatedInstallments, setRelatedInstallments] = React.useState<
    Transaction[]
  >([]);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await TransactionService.getTransactionById(transactionId);
        if (data) {
          setTransaction(data);

          // If this is an installment or recurring, fetch all related
          const groupId = data.installmentGroupId || data.recurringGroupId;
          if ((data.isInstallment || data.isRecurring) && groupId) {
            const allTransactions = await TransactionService.getTransactions(
              data.tenantId,
            );
            const related = allTransactions
              .filter(
                (t) => (t.installmentGroupId || t.recurringGroupId) === groupId,
              )
              .sort(
                (a, b) =>
                  (a.installmentNumber || 0) - (b.installmentNumber || 0),
              );
            setRelatedInstallments(related);
          }
        }
      } catch (error) {
        console.error("Error fetching transaction:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (transactionId) {
      fetchData();
    }
  }, [transactionId]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return formatDateBR(dateString, "");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Lançamento não encontrado</p>
        <Button variant="outline" onClick={() => router.push("/transactions")}>
          Voltar para Financeiro
        </Button>
      </div>
    );
  }

  const typeInfo = typeConfig[transaction.type];
  const statusInfo = statusConfig[transaction.status];
  const TypeIcon = typeInfo.icon;

  // Calculate total for installments
  const totalAmount =
    relatedInstallments.length > 0
      ? relatedInstallments.reduce((sum, t) => sum + t.amount, 0)
      : transaction.amount;

  const paidAmount =
    relatedInstallments.length > 0
      ? relatedInstallments
          .filter((t) => t.status === "paid")
          .reduce((sum, t) => sum + t.amount, 0)
      : transaction.status === "paid"
        ? transaction.amount
        : 0;

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
              Detalhes do Lançamento
            </h1>
            <p className="text-muted-foreground text-sm">
              Visualize as informações completas
            </p>
          </div>
        </div>
        {canEdit && (
          <Link href={`/transactions/${transactionId}`}>
            <Button className="gap-2">
              <Edit className="w-4 h-4" />
              Editar
            </Button>
          </Link>
        )}
      </div>

      {/* Main Info Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-full bg-muted ${typeInfo.color}`}>
              <TypeIcon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-semibold">
                  {transaction.description}
                </h2>
                <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
              </div>
              <p className={`text-3xl font-bold ${typeInfo.color}`}>
                {transaction.type === "expense" ? "-" : "+"}
                {formatCurrency(transaction.amount)}
              </p>
              {transaction.isInstallment && (
                <p className="text-sm text-muted-foreground mt-1">
                  Parcela {transaction.installmentNumber} de{" "}
                  {transaction.installmentCount}
                </p>
              )}
              {transaction.isRecurring && (
                <p className="text-sm text-muted-foreground mt-1">
                  Recorrência #{transaction.installmentNumber}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {formatDate(transaction.date)}
            </p>
            {transaction.dueDate && (
              <p className="text-sm text-muted-foreground">
                Vencimento: {formatDate(transaction.dueDate)}
              </p>
            )}
          </CardContent>
        </Card>

        {transaction.wallet && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Carteira
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">{transaction.wallet}</p>
            </CardContent>
          </Card>
        )}

        {transaction.category && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                Categoria
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">{transaction.category}</p>
            </CardContent>
          </Card>
        )}

        {transaction.clientName && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User className="w-4 h-4" />
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">{transaction.clientName}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Notes */}
      {transaction.notes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Observações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">
              {transaction.notes}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Installments List */}
      {relatedInstallments.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                {transaction.isRecurring
                  ? `Recorrências (${relatedInstallments.length})`
                  : `Parcelas (${relatedInstallments.length}x)`}
              </span>
              <div className="text-sm font-normal text-muted-foreground">
                Total: {formatCurrency(totalAmount)} | Pago:{" "}
                {formatCurrency(paidAmount)}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {relatedInstallments.map((installment) => {
                const instStatusInfo = statusConfig[installment.status];
                return (
                  <div
                    key={installment.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium w-8">
                        {transaction.isRecurring
                          ? `#${installment.installmentNumber}`
                          : `${installment.installmentNumber}/${installment.installmentCount}`}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(installment.dueDate || installment.date)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`font-medium ${typeInfo.color}`}>
                        {formatCurrency(installment.amount)}
                      </span>
                      <Badge
                        variant={instStatusInfo.variant}
                        className="text-xs"
                      >
                        {instStatusInfo.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <div className="text-xs text-muted-foreground text-center">
        Criado em {formatDateTimeBR(transaction.createdAt)} | Atualizado em{" "}
        {formatDateTimeBR(transaction.updatedAt)}
      </div>
    </div>
  );
}
