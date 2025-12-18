"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { ClientSelect } from "@/components/features/client-select";
import { DynamicSelect } from "@/components/features/dynamic-select";
import {
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  CreditCard,
  Calendar,
} from "lucide-react";
import { TransactionFormData } from "../_hooks/useTransactionForm";
import {
  TransactionType,
  TransactionStatus,
} from "@/services/transaction-service";

// ============================================
// TYPE SELECTOR
// ============================================

interface TypeSelectorCardProps {
  type: TransactionType;
  onTypeChange: (type: TransactionType) => void;
}

export function TypeSelectorCard({
  type,
  onTypeChange,
}: TypeSelectorCardProps) {
  return (
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
            onClick={() => onTypeChange("income")}
            className={`flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all ${
              type === "income"
                ? "border-green-500 bg-green-500/10 text-green-500"
                : "border-border hover:border-green-500/50"
            }`}
          >
            <ArrowUpCircle className="w-5 h-5" />
            <span className="font-medium">Receita</span>
          </button>
          <button
            type="button"
            onClick={() => onTypeChange("expense")}
            className={`flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all ${
              type === "expense"
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
  );
}

// ============================================
// DETAILS CARD
// ============================================

interface DetailsCardProps {
  formData: TransactionFormData;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
}

export function DetailsCard({ formData, onChange }: DetailsCardProps) {
  return (
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
            onChange={onChange}
            placeholder="Ex: Venda de projeto, Compra de material..."
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="amount">Valor Total *</Label>
            <CurrencyInput
              id="amount"
              name="amount"
              value={formData.amount}
              onChange={onChange}
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
              onChange={onChange}
              placeholder="Ex: Vendas, Material, Mão de obra..."
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="date">Data *</Label>
            <DateInput
              id="date"
              name="date"
              value={formData.date}
              onChange={onChange}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dueDate">Vencimento</Label>
            <DateInput
              id="dueDate"
              name="dueDate"
              value={formData.dueDate}
              onChange={onChange}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="status">Status</Label>
            <Select
              id="status"
              name="status"
              value={formData.status}
              onChange={onChange}
            >
              <option value="pending">Pendente</option>
              <option value="paid">Pago</option>
              <option value="overdue">Atrasado</option>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// PAYMENT CARD
// ============================================

interface PaymentCardProps {
  formData: TransactionFormData;
  onFormDataChange: React.Dispatch<React.SetStateAction<TransactionFormData>>;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
}

export function PaymentCard({
  formData,
  onFormDataChange,
  onChange,
}: PaymentCardProps) {
  return (
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
          onChange={onChange}
        />

        <div className="border rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isInstallment"
              name="isInstallment"
              checked={formData.isInstallment}
              onChange={onChange}
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
                    onFormDataChange((prev) => ({
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
  );
}

// ============================================
// CLIENT CARD
// ============================================

interface ClientCardProps {
  clientName: string;
  clientId?: string;
  onClientChange: (data: {
    clientId?: string;
    clientName: string;
    isNew: boolean;
  }) => void;
}

export function ClientCard({
  clientName,
  clientId,
  onClientChange,
}: ClientCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cliente (Opcional)</CardTitle>
      </CardHeader>
      <CardContent>
        <ClientSelect
          value={clientName}
          clientId={clientId}
          onChange={onClientChange}
        />
      </CardContent>
    </Card>
  );
}

// ============================================
// NOTES CARD
// ============================================

interface NotesCardProps {
  notes: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

export function NotesCard({ notes, onChange }: NotesCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Observações</CardTitle>
      </CardHeader>
      <CardContent>
        <Textarea
          id="notes"
          name="notes"
          value={notes}
          onChange={onChange}
          placeholder="Anotações adicionais..."
          rows={3}
        />
      </CardContent>
    </Card>
  );
}
