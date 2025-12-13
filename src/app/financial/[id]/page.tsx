"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  TransactionService,
  Transaction,
  TransactionType,
  TransactionStatus,
} from "@/services/transaction-service";
import { ClientSelect } from "@/components/features/client-select";
import { DynamicSelect } from "@/components/features/dynamic-select";
import {
  ArrowLeft,
  Loader2,
  Save,
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  CreditCard,
  Clock,
} from "lucide-react";

export default function EditTransactionPage() {
  const router = useRouter();
  const params = useParams();
  const transactionId = params.id as string;

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [transaction, setTransaction] = React.useState<Transaction | null>(
    null
  );
  const [relatedInstallments, setRelatedInstallments] = React.useState<
    Transaction[]
  >([]);

  const [formData, setFormData] = React.useState({
    type: "income" as TransactionType,
    description: "",
    amount: "",
    date: "",
    dueDate: "",
    status: "pending" as TransactionStatus,
    clientId: undefined as string | undefined,
    clientName: "",
    category: "",
    wallet: "",
    notes: "",
  });

  React.useEffect(() => {
    const fetchTransaction = async () => {
      try {
        const data = await TransactionService.getTransactionById(transactionId);
        if (data) {
          setTransaction(data);
          setFormData({
            type: data.type,
            description: data.description,
            amount: data.amount.toString(),
            date: data.date.split("T")[0],
            dueDate: data.dueDate?.split("T")[0] || "",
            status: data.status,
            clientId: data.clientId,
            clientName: data.clientName || "",
            category: data.category || "",
            wallet: data.wallet || "",
            notes: data.notes || "",
          });

          // If this is an installment, fetch all related installments
          if (data.isInstallment && data.installmentGroupId) {
            const allTransactions = await TransactionService.getTransactions(
              data.tenantId
            );
            const related = allTransactions
              .filter((t) => t.installmentGroupId === data.installmentGroupId)
              .sort(
                (a, b) =>
                  (a.installmentNumber || 0) - (b.installmentNumber || 0)
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
      fetchTransaction();
    }
  }, [transactionId]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleClientChange = (data: {
    clientId?: string;
    clientName: string;
    isNew: boolean;
  }) => {
    setFormData((prev) => ({
      ...prev,
      clientId: data.clientId,
      clientName: data.clientName,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.description.trim() || !formData.amount) {
      alert("Preencha a descrição e o valor!");
      return;
    }

    setIsSaving(true);

    try {
      await TransactionService.updateTransaction(transactionId, {
        type: formData.type,
        description: formData.description.trim(),
        amount: parseFloat(formData.amount),
        date: formData.date,
        dueDate: formData.dueDate || undefined,
        status: formData.status,
        clientId: formData.clientId,
        clientName: formData.clientName || undefined,
        category: formData.category || undefined,
        wallet: formData.wallet || undefined,
        notes: formData.notes || undefined,
      });

      router.push("/financial");
    } catch (error) {
      console.error("Error updating transaction:", error);
      alert("Erro ao atualizar lançamento");
    } finally {
      setIsSaving(false);
    }
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
        <Button variant="outline" onClick={() => router.push("/financial")}>
          Voltar para Financeiro
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/financial")}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Editar Lançamento
          </h1>
          <p className="text-muted-foreground text-sm">
            Atualize as informações do lançamento
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Type Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Tipo de Lançamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({ ...prev, type: "income" }))
                }
                className={`flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  formData.type === "income"
                    ? "border-green-500 bg-green-500/10 text-green-500"
                    : "border-border hover:border-green-500/50"
                }`}
              >
                <ArrowUpCircle className="w-5 h-5" />
                <span className="font-medium">Receita</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({ ...prev, type: "expense" }))
                }
                className={`flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  formData.type === "expense"
                    ? "border-red-500 bg-red-500/10 text-red-500"
                    : "border-border hover:border-red-500/50"
                }`}
              >
                <ArrowDownCircle className="w-5 h-5" />
                <span className="font-medium">Despesa</span>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Details */}
        <Card>
          <CardHeader>
            <CardTitle>Detalhes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="description">Descrição *</Label>
              <Input
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Ex: Venda de projeto, Compra de material..."
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="amount">Valor *</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={handleChange}
                  placeholder="0,00"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category">Categoria</Label>
                <Input
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  placeholder="Ex: Vendas, Material, Mão de obra..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="date">Data *</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dueDate">Vencimento</Label>
                <Input
                  id="dueDate"
                  name="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={handleChange}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                >
                  <option value="pending">Pendente</option>
                  <option value="paid">Pago</option>
                  <option value="overdue">Atrasado</option>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Wallet */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DynamicSelect
              storageKey="wallets"
              label="Carteira / Forma de Pagamento"
              name="wallet"
              value={formData.wallet}
              onChange={handleChange}
            />
          </CardContent>
        </Card>

        {/* Related Installments */}
        {relatedInstallments.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Parcelas ({relatedInstallments.length}x)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {relatedInstallments.map((installment) => (
                  <Link
                    key={installment.id}
                    href={`/financial/${installment.id}`}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      installment.id === transactionId
                        ? "bg-primary/10 border-primary"
                        : "hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-sm font-medium ${
                          installment.id === transactionId ? "text-primary" : ""
                        }`}
                      >
                        Parcela {installment.installmentNumber}/
                        {installment.installmentCount}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(installment.date).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          installment.status === "paid"
                            ? "success"
                            : installment.status === "overdue"
                              ? "destructive"
                              : "warning"
                        }
                        className="text-xs"
                      >
                        {installment.status === "paid"
                          ? "Pago"
                          : installment.status === "overdue"
                            ? "Atrasado"
                            : "Pendente"}
                      </Badge>
                      {installment.id === transactionId && (
                        <Badge variant="outline" className="text-xs">
                          Editando
                        </Badge>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Client */}
        <Card>
          <CardHeader>
            <CardTitle>Cliente (Opcional)</CardTitle>
          </CardHeader>
          <CardContent>
            <ClientSelect
              value={formData.clientName}
              clientId={formData.clientId}
              onChange={handleClientChange}
            />
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Anotações adicionais..."
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/financial")}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isSaving} className="gap-2">
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Salvar Alterações
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
