"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DateInput } from "@/components/ui/date-input";
import { ClientSelect } from "@/components/features/client-select";
import { WalletSelect } from "@/components/features/wallet-select";
// import { DynamicSelect } from "@/components/features/dynamic-select";
import {
  FormSection,
  FormGroup,
  FormItem,
} from "@/components/ui/form-components";
import {
  TrendingUp,
  TrendingDown,
  FileText,
  CreditCard,
  User,
  Calendar,
  DollarSign,
  Tag,
  Clock,
  Wallet,
} from "lucide-react";
import { TransactionFormData } from "../_hooks/useTransactionForm";
import { TransactionType } from "@/services/transaction-service";

// ============================================
// TYPE SELECTOR - Income/Expense toggle
// ============================================

interface TypeSelectorNewProps {
  type: TransactionType;
  onTypeChange: (type: TransactionType) => void;
}

export function TypeSelectorNew({ type, onTypeChange }: TypeSelectorNewProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Income Button */}
      <button
        type="button"
        onClick={() => onTypeChange("income")}
        className={`
          relative overflow-hidden rounded-2xl border-2 p-6 transition-all duration-300
          ${
            type === "income"
              ? "border-green-500 bg-gradient-to-br from-green-500/10 to-green-500/5 shadow-lg shadow-green-500/10"
              : "border-border/50 bg-card hover:border-green-500/40 hover:bg-green-500/5"
          }
        `}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className={`
            w-14 h-14 rounded-2xl flex items-center justify-center transition-all
            ${
              type === "income"
                ? "bg-green-500 text-white shadow-lg shadow-green-500/30"
                : "bg-green-500/10 text-green-500"
            }
          `}
          >
            <TrendingUp className="w-7 h-7" />
          </div>
          <div className="text-center">
            <p
              className={`font-bold text-lg ${type === "income" ? "text-green-600 dark:text-green-400" : "text-foreground"}`}
            >
              Receita
            </p>
            <p className="text-xs text-muted-foreground">Entrada de dinheiro</p>
          </div>
        </div>
        {type === "income" && (
          <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        )}
      </button>

      {/* Expense Button */}
      <button
        type="button"
        onClick={() => onTypeChange("expense")}
        className={`
          relative overflow-hidden rounded-2xl border-2 p-6 transition-all duration-300
          ${
            type === "expense"
              ? "border-red-500 bg-gradient-to-br from-red-500/10 to-red-500/5 shadow-lg shadow-red-500/10"
              : "border-border/50 bg-card hover:border-red-500/40 hover:bg-red-500/5"
          }
        `}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className={`
            w-14 h-14 rounded-2xl flex items-center justify-center transition-all
            ${
              type === "expense"
                ? "bg-red-500 text-white shadow-lg shadow-red-500/30"
                : "bg-red-500/10 text-red-500"
            }
          `}
          >
            <TrendingDown className="w-7 h-7" />
          </div>
          <div className="text-center">
            <p
              className={`font-bold text-lg ${type === "expense" ? "text-red-600 dark:text-red-400" : "text-foreground"}`}
            >
              Despesa
            </p>
            <p className="text-xs text-muted-foreground">Saída de dinheiro</p>
          </div>
        </div>
        {type === "expense" && (
          <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        )}
      </button>
    </div>
  );
}

// ============================================
// DETAILS SECTION
// ============================================

interface DetailsSectionProps {
  formData: TransactionFormData;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
}

export function DetailsSection({ formData, onChange }: DetailsSectionProps) {
  return (
    <FormSection
      title="Detalhes do Lançamento"
      description="Informações básicas sobre a transação"
      icon={FileText}
    >
      <FormItem label="Descrição" htmlFor="description" required>
        <Input
          id="description"
          name="description"
          value={formData.description}
          onChange={onChange}
          placeholder="Ex: Venda de equipamentos, Pagamento de fornecedor..."
          icon={<FileText className="w-4 h-4" />}
          required
        />
      </FormItem>

      <FormGroup>
        <FormItem label="Valor Total" htmlFor="amount" required>
          <CurrencyInput
            id="amount"
            name="amount"
            value={formData.amount}
            onChange={onChange}
            placeholder="0,00"
            required
          />
        </FormItem>

        <FormItem label="Categoria" htmlFor="category">
          <Input
            id="category"
            name="category"
            value={formData.category}
            onChange={onChange}
            placeholder="Vendas, Material, Serviço..."
            icon={<Tag className="w-4 h-4" />}
          />
        </FormItem>
      </FormGroup>

      <FormGroup cols={3}>
        <FormItem label="Data" htmlFor="date" required>
          <DateInput
            id="date"
            name="date"
            value={formData.date}
            onChange={onChange}
            required
          />
        </FormItem>

        <FormItem
          label="Vencimento"
          htmlFor="dueDate"
          required={formData.type === "income"}
        >
          <DateInput
            id="dueDate"
            name="dueDate"
            value={formData.dueDate}
            onChange={onChange}
            required={formData.type === "income"}
          />
        </FormItem>

        <FormItem label="Status" htmlFor="status">
          <Select
            id="status"
            name="status"
            value={formData.status}
            onChange={onChange}
          >
            <option value="pending">⏳ Pendente</option>
            <option value="paid">✅ Pago</option>
            <option value="overdue">⚠️ Atrasado</option>
          </Select>
        </FormItem>
      </FormGroup>
    </FormSection>
  );
}

// ============================================
// PAYMENT SECTION
// ============================================

interface PaymentSectionProps {
  formData: TransactionFormData;
  onFormDataChange: React.Dispatch<React.SetStateAction<TransactionFormData>>;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
}

export function PaymentSection({
  formData,
  onFormDataChange,
  onChange,
}: PaymentSectionProps) {
  return (
    <FormSection
      title="Forma de Pagamento"
      description="Configure como será pago este lançamento"
      icon={CreditCard}
    >
      <WalletSelect
        label="Carteira / Método"
        name="wallet"
        value={formData.wallet}
        onChange={onChange}
      />

      {/* Installments Card */}
      <div
        className={`
        rounded-xl border-2 p-5 transition-all duration-300
        ${
          formData.isInstallment
            ? "border-primary/30 bg-gradient-to-br from-primary/5 to-transparent"
            : "border-border/50 bg-muted/20"
        }
      `}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className={`
            w-10 h-10 rounded-xl flex items-center justify-center
            ${formData.isInstallment ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}
          `}
          >
            <Calendar className="w-5 h-5" />
          </div>
          <label htmlFor="isInstallment" className="flex-1 cursor-pointer">
            <p className="font-semibold text-foreground">Parcelar Lançamento</p>
            <p className="text-sm text-muted-foreground">
              Divida o valor em múltiplas parcelas
            </p>
          </label>
          <input
            type="checkbox"
            id="isInstallment"
            name="isInstallment"
            checked={formData.isInstallment}
            onChange={onChange}
            className="w-6 h-6 rounded-lg border-2 border-border text-primary focus:ring-primary/20 cursor-pointer"
          />
        </div>

        {formData.isInstallment && (
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/30 animate-in slide-in-from-top-2 duration-200">
            <FormItem label="Número de Parcelas" htmlFor="installmentCount">
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
                    {n}x parcelas
                  </option>
                ))}
              </Select>
            </FormItem>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Valor por Parcela</Label>
              <div className="h-12 px-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                <span className="font-bold text-primary">
                  {formData.amount
                    ? `R$ ${(parseFloat(formData.amount) / formData.installmentCount).toFixed(2)}`
                    : "R$ 0,00"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </FormSection>
  );
}

// ============================================
// CLIENT SECTION
// ============================================

interface ClientSectionProps {
  clientName: string;
  clientId?: string;
  transactionType: "income" | "expense";
  onClientChange: (data: {
    clientId?: string;
    clientName: string;
    isNew: boolean;
  }) => void;
}

export function ClientSection({
  clientName,
  clientId,
  transactionType,
  onClientChange,
}: ClientSectionProps) {
  return (
    <FormSection
      title={`Cliente Relacionado${transactionType === "income" ? " *" : ""}`}
      description="Vincule este lançamento a um cliente"
      icon={User}
      collapsible
      defaultOpen={!!clientName}
    >
      <ClientSelect
        value={clientName}
        clientId={clientId}
        onChange={onClientChange}
      />
    </FormSection>
  );
}

// ============================================
// NOTES SECTION
// ============================================

interface NotesSectionProps {
  notes: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

export function NotesSection({ notes, onChange }: NotesSectionProps) {
  return (
    <FormSection
      title="Observações"
      description="Anotações adicionais sobre o lançamento"
      icon={FileText}
      collapsible
      defaultOpen={!!notes}
    >
      <Textarea
        id="notes"
        name="notes"
        value={notes}
        onChange={onChange}
        placeholder="Detalhes adicionais, referências, informações importantes..."
        className="min-h-[100px]"
      />
    </FormSection>
  );
}
