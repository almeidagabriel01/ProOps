"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import {
  TransactionService,
  TransactionType,
  TransactionStatus,
} from "@/services/transaction-service";
import { ClientService } from "@/services/client-service";
import { ClientSelect } from "@/components/features/client-select";
import { DynamicSelect } from "@/components/features/dynamic-select";
import { useTenant } from "@/providers/tenant-provider";
import {
  ArrowLeft,
  Loader2,
  Save,
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  CreditCard,
  Calendar,
} from "lucide-react";

export default function NewTransactionPage() {
  const router = useRouter();
  const { tenant } = useTenant();
  const [isSaving, setIsSaving] = React.useState(false);

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
    isInstallment: false,
    installmentCount: 2,
    notes: "",
  });

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
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

    if (!tenant) {
      alert("Erro: Nenhuma empresa selecionada!");
      return;
    }

    if (!formData.description.trim() || !formData.amount) {
      alert("Preencha a descrição e o valor!");
      return;
    }

    setIsSaving(true);

    try {
      // If new client, create it first
      let clientId = formData.clientId;
      if (!clientId && formData.clientName.trim()) {
        const { client } = await ClientService.findOrCreateClient(
          tenant.id,
          { name: formData.clientName },
          "financial"
        );
        clientId = client.id;
      }

      const now = new Date().toISOString();
      const baseAmount = parseFloat(formData.amount);

      if (formData.isInstallment && formData.installmentCount > 1) {
        // Create multiple transactions for installments
        const installmentGroupId = `installment_${Date.now()}`;
        const installmentAmount = baseAmount / formData.installmentCount;
        const baseDate = new Date(formData.date);

        for (let i = 0; i < formData.installmentCount; i++) {
          const installmentDate = new Date(baseDate);
          installmentDate.setMonth(installmentDate.getMonth() + i);

          await TransactionService.createTransaction({
            tenantId: tenant.id,
            type: formData.type,
            description: formData.description.trim(),
            amount: Math.round(installmentAmount * 100) / 100,
            date: installmentDate.toISOString().split("T")[0],
            dueDate: installmentDate.toISOString().split("T")[0],
            status: i === 0 ? formData.status : "pending",
            clientId,
            clientName: formData.clientName || undefined,
            category: formData.category || undefined,
            wallet: formData.wallet || undefined,
            isInstallment: true,
            installmentCount: formData.installmentCount,
            installmentNumber: i + 1,
            installmentGroupId,
            notes: formData.notes || undefined,
            createdAt: now,
            updatedAt: now,
          });
        }
      } else {
        // Single transaction
        await TransactionService.createTransaction({
          tenantId: tenant.id,
          type: formData.type,
          description: formData.description.trim(),
          amount: baseAmount,
          date: formData.date,
          dueDate: formData.dueDate || undefined,
          status: formData.status,
          clientId,
          clientName: formData.clientName || undefined,
          category: formData.category || undefined,
          wallet: formData.wallet || undefined,
          notes: formData.notes || undefined,
          createdAt: now,
          updatedAt: now,
        });
      }

      router.push("/financial");
    } catch (error) {
      console.error("Error creating transaction:", error);
      alert("Erro ao criar lançamento");
    } finally {
      setIsSaving(false);
    }
  };

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
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Novo Lançamento</h1>
          <p className="text-muted-foreground text-sm">
            Registre uma receita ou despesa
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
                <Label htmlFor="amount">Valor Total *</Label>
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

        {/* Wallet & Installments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DynamicSelect
              storageKey="wallets"
              label="Carteira / Forma de Pagamento"
              name="wallet"
              value={formData.wallet}
              onChange={handleChange}
            />

            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isInstallment"
                  name="isInstallment"
                  checked={formData.isInstallment}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label
                  htmlFor="isInstallment"
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Calendar className="w-4 h-4" />
                  Parcelar este lançamento
                </Label>
              </div>

              {formData.isInstallment && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="grid gap-2">
                    <Label htmlFor="installmentCount">Número de Parcelas</Label>
                    <Select
                      id="installmentCount"
                      name="installmentCount"
                      value={formData.installmentCount.toString()}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          installmentCount: parseInt(e.target.value),
                        }))
                      }
                    >
                      {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24].map((n) => (
                        <option key={n} value={n}>
                          {n}x
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Valor por Parcela</Label>
                    <div className="h-10 px-3 py-2 bg-muted rounded-md flex items-center text-sm font-medium">
                      {formData.amount
                        ? `R$ ${(parseFloat(formData.amount) / formData.installmentCount).toFixed(2)}`
                        : "R$ 0,00"}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

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
                {formData.isInstallment
                  ? `Criar ${formData.installmentCount} Parcelas`
                  : "Salvar Lançamento"}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
