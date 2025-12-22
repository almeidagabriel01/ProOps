"use client";

import { FormCard } from "@/components/ui/form-card";
import { FormField, FormRow } from "@/components/ui/form-field";
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
  FileText,
  User,
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
    <FormCard
      title="Tipo de Lançamento"
      description="Selecione se é uma receita ou despesa"
      icon={Wallet}
    >
      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => onTypeChange("income")}
          className={`flex items-center justify-center gap-3 p-5 rounded-xl border-2 transition-all duration-200 ${
            type === "income"
              ? "border-green-500 bg-green-500/10 text-green-600 dark:text-green-400 shadow-sm"
              : "border-border bg-card hover:border-green-500/50 hover:bg-green-500/5"
          }`}
        >
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              type === "income" ? "bg-green-500/20" : "bg-muted"
            }`}
          >
            <ArrowUpCircle className="w-5 h-5" />
          </div>
          <span className="font-semibold text-base">Receita</span>
        </button>
        <button
          type="button"
          onClick={() => onTypeChange("expense")}
          className={`flex items-center justify-center gap-3 p-5 rounded-xl border-2 transition-all duration-200 ${
            type === "expense"
              ? "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400 shadow-sm"
              : "border-border bg-card hover:border-red-500/50 hover:bg-red-500/5"
          }`}
        >
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              type === "expense" ? "bg-red-500/20" : "bg-muted"
            }`}
          >
            <ArrowDownCircle className="w-5 h-5" />
          </div>
          <span className="font-semibold text-base">Despesa</span>
        </button>
      </div>
    </FormCard>
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
    <FormCard
      title="Detalhes"
      description="Informações sobre o lançamento"
      icon={FileText}
    >
      <FormField label="Descrição" htmlFor="description" required>
        <Input
          id="description"
          name="description"
          value={formData.description}
          onChange={onChange}
          placeholder="Ex: Venda de projeto, Compra de material..."
          required
        />
      </FormField>

      <FormRow>
        <FormField label="Valor Total" htmlFor="amount" required>
          <CurrencyInput
            id="amount"
            name="amount"
            value={formData.amount}
            onChange={onChange}
            placeholder="0,00"
            required
          />
        </FormField>
        <FormField label="Categoria" htmlFor="category">
          <Input
            id="category"
            name="category"
            value={formData.category}
            onChange={onChange}
            placeholder="Ex: Vendas, Material, Mão de obra..."
          />
        </FormField>
      </FormRow>

      <FormRow cols={3}>
        <FormField label="Data" htmlFor="date" required>
          <DateInput
            id="date"
            name="date"
            value={formData.date}
            onChange={onChange}
            required
          />
        </FormField>
        <FormField label="Vencimento" htmlFor="dueDate">
          <DateInput
            id="dueDate"
            name="dueDate"
            value={formData.dueDate}
            onChange={onChange}
          />
        </FormField>
        <FormField label="Status" htmlFor="status">
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
        </FormField>
      </FormRow>
    </FormCard>
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
    <FormCard
      title="Pagamento"
      description="Forma de pagamento e parcelamento"
      icon={CreditCard}
    >
      <DynamicSelect
        storageKey="wallets"
        label="Carteira / Forma de Pagamento"
        name="wallet"
        value={formData.wallet}
        onChange={onChange}
      />

      <div className="rounded-xl border border-border p-4 space-y-4 bg-muted/30">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="isInstallment"
            name="isInstallment"
            checked={formData.isInstallment}
            onChange={onChange}
            className="h-4 w-4 rounded border-input text-primary focus:ring-primary/20"
          />
          <Label
            htmlFor="isInstallment"
            className="flex items-center gap-2 cursor-pointer text-sm font-medium"
          >
            <Calendar className="w-4 h-4 text-muted-foreground" />
            Parcelar este lançamento
          </Label>
        </div>

        {formData.isInstallment && (
          <FormRow>
            <FormField label="Número de Parcelas" htmlFor="installmentCount">
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
            </FormField>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Valor por Parcela</Label>
              <div className="h-10 px-4 bg-primary/5 border border-primary/20 rounded-lg flex items-center text-sm font-semibold text-primary">
                {formData.amount
                  ? `R$ ${(parseFloat(formData.amount) / formData.installmentCount).toFixed(2)}`
                  : "R$ 0,00"}
              </div>
            </div>
          </FormRow>
        )}
      </div>
    </FormCard>
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
    <FormCard
      title="Cliente"
      description="Vincule este lançamento a um cliente"
      icon={User}
    >
      <ClientSelect
        value={clientName}
        clientId={clientId}
        onChange={onClientChange}
      />
    </FormCard>
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
    <FormCard
      title="Observações"
      description="Informações adicionais sobre o lançamento"
      icon={FileText}
      collapsible
      defaultCollapsed
    >
      <Textarea
        id="notes"
        name="notes"
        value={notes}
        onChange={onChange}
        placeholder="Anotações adicionais..."
        rows={3}
      />
    </FormCard>
  );
}
