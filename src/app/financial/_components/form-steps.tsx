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
import { FormGroup, FormItem } from "@/components/ui/form-components";
import { formatCurrency } from "@/utils/format";
import { FormErrors } from "@/hooks/useFormValidation";
import {
  TrendingUp,
  TrendingDown,
  FileText,
  CreditCard,
  User,
  Calendar,
  DollarSign,
  Tag,
  Check,
} from "lucide-react";
import { TransactionFormData } from "../_hooks/useTransactionForm";
import { TransactionType } from "@/services/transaction-service";

// ============================================
// STEP 1: TYPE SELECTOR
// ============================================

interface TypeSelectorStepProps {
  type: TransactionType;
  onTypeChange: (type: TransactionType) => void;
}

export function TypeSelectorStep({
  type,
  onTypeChange,
}: TypeSelectorStepProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center">
          {type === "income" ? (
            <TrendingUp className="w-6 h-6 text-green-600" />
          ) : (
            <TrendingDown className="w-6 h-6 text-red-500" />
          )}
        </div>
        <div>
          <h3 className="text-lg font-semibold">Tipo de Lançamento</h3>
          <p className="text-sm text-muted-foreground">
            Escolha entre receita ou despesa
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Income */}
        <button
          type="button"
          onClick={() => onTypeChange("income")}
          className={`
            relative rounded-2xl border-2 p-8 transition-all duration-300 cursor-pointer
            ${type === "income"
              ? "border-green-500 bg-gradient-to-br from-green-500/10 to-green-500/5 shadow-xl shadow-green-500/10"
              : "border-border/50 bg-card hover:border-green-500/40 hover:shadow-lg"
            }
          `}
        >
          {type === "income" && (
            <div className="absolute top-4 right-4 w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shadow-lg">
              <Check className="w-4 h-4 text-white" />
            </div>
          )}
          <div className="flex flex-col items-center gap-4">
            <div
              className={`
              w-20 h-20 rounded-2xl flex items-center justify-center transition-all
              ${type === "income"
                  ? "bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-xl shadow-green-500/30"
                  : "bg-green-500/10 text-green-600"
                }
            `}
            >
              <TrendingUp className="w-10 h-10" />
            </div>
            <div className="text-center">
              <p
                className={`font-bold text-xl ${type === "income" ? "text-green-600" : "text-foreground"}`}
              >
                Receita
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Entrada de dinheiro
              </p>
            </div>
          </div>
        </button>

        {/* Expense */}
        <button
          type="button"
          onClick={() => onTypeChange("expense")}
          className={`
            relative rounded-2xl border-2 p-8 transition-all duration-300 cursor-pointer
            ${type === "expense"
              ? "border-red-500 bg-gradient-to-br from-red-500/10 to-red-500/5 shadow-xl shadow-red-500/10"
              : "border-border/50 bg-card hover:border-red-500/40 hover:shadow-lg"
            }
          `}
        >
          {type === "expense" && (
            <div className="absolute top-4 right-4 w-7 h-7 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
              <Check className="w-4 h-4 text-white" />
            </div>
          )}
          <div className="flex flex-col items-center gap-4">
            <div
              className={`
              w-20 h-20 rounded-2xl flex items-center justify-center transition-all
              ${type === "expense"
                  ? "bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-xl shadow-red-500/30"
                  : "bg-red-500/10 text-red-500"
                }
            `}
            >
              <TrendingDown className="w-10 h-10" />
            </div>
            <div className="text-center">
              <p
                className={`font-bold text-xl ${type === "expense" ? "text-red-600" : "text-foreground"}`}
              >
                Despesa
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Saída de dinheiro
              </p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

// ============================================
// STEP 2: DETAILS
// ============================================

interface DetailsStepProps {
  formData: TransactionFormData;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => void;
  errors?: FormErrors<TransactionFormData>;
}

export function DetailsStep({
  formData,
  onChange,
  onBlur,
  errors = {},
}: DetailsStepProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/15 to-blue-500/5 flex items-center justify-center">
          <FileText className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Detalhes do Lançamento</h3>
          <p className="text-sm text-muted-foreground">
            Informações básicas sobre a transação
          </p>
        </div>
      </div>

      <FormItem
        label="Descrição"
        htmlFor="description"
        required
        error={errors.description}
      >
        <Input
          id="description"
          name="description"
          value={formData.description}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="Ex: Venda de equipamentos, Pagamento de fornecedor..."
          icon={<FileText className="w-4 h-4" />}
          className={errors.description ? "border-destructive" : ""}
          required
        />
      </FormItem>

      <FormGroup>
        <FormItem
          label="Valor Total"
          htmlFor="amount"
          required
          error={errors.amount}
        >
          <CurrencyInput
            id="amount"
            name="amount"
            value={formData.amount}
            onChange={onChange}
            onBlur={onBlur}
            placeholder="0,00"
            className={errors.amount ? "border-destructive" : ""}
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
        <FormItem label="Data" htmlFor="date" required error={errors.date}>
          <DateInput
            id="date"
            name="date"
            value={formData.date}
            onChange={onChange}
            onBlur={onBlur}
            className={errors.date ? "border-destructive" : ""}
            required
          />
        </FormItem>

        <FormItem
          label="Vencimento"
          htmlFor="dueDate"
          required={formData.type === "income"}
          error={errors.dueDate}
        >
          <DateInput
            id="dueDate"
            name="dueDate"
            value={formData.dueDate}
            onChange={onChange}
            onBlur={onBlur}
            className={errors.dueDate ? "border-destructive" : ""}
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
    </div>
  );
}

// ============================================
// STEP 3: PAYMENT
// ============================================

interface PaymentStepProps {
  formData: TransactionFormData;
  onFormDataChange: React.Dispatch<React.SetStateAction<TransactionFormData>>;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  errors?: FormErrors<TransactionFormData>;
}

export function PaymentStep({
  formData,
  onFormDataChange,
  onChange,
  errors = {},
}: PaymentStepProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/15 to-purple-500/5 flex items-center justify-center">
          <CreditCard className="w-6 h-6 text-purple-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Forma de Pagamento</h3>
          <p className="text-sm text-muted-foreground">
            Configure como será pago este lançamento
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <WalletSelect
          name="wallet"
          value={formData.wallet}
          onChange={onChange}
          required
          error={errors.wallet}
        />
      </div>

      {/* Installments Card */}
      <div
        className={`
        rounded-2xl border-2 p-6 transition-all duration-300
        ${formData.isInstallment
            ? "border-primary/30 bg-gradient-to-br from-primary/5 to-transparent shadow-lg"
            : "border-border/50 bg-card hover:border-primary/20"
          }
      `}
      >
        <div className="flex items-center gap-4">
          <div
            className={`
            w-12 h-12 rounded-xl flex items-center justify-center transition-all
            ${formData.isInstallment ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}
          `}
          >
            <Calendar className="w-6 h-6" />
          </div>
          <label htmlFor="isInstallment" className="flex-1 cursor-pointer">
            <p className="font-semibold text-foreground text-lg">
              Parcelar Lançamento
            </p>
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
            className="w-7 h-7 rounded-lg border-2 border-border text-primary focus:ring-primary/20 cursor-pointer"
          />
        </div>

        {formData.isInstallment && (
          <div className="grid grid-cols-2 gap-6 pt-6 mt-6 border-t border-border/30 animate-in slide-in-from-top-2 duration-300">
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
              <div className="h-12 px-5 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                <span className="font-bold text-xl text-primary">
                  {formData.amount
                    ? `R$ ${(parseFloat(formData.amount) / formData.installmentCount).toFixed(2)}`
                    : "R$ 0,00"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// STEP 4: REVIEW
// ============================================

interface ReviewStepProps {
  formData: TransactionFormData;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onClientChange: (data: {
    clientId?: string;
    clientName: string;
    isNew: boolean;
  }) => void;
  errors?: FormErrors<TransactionFormData>;
  totalOverride?: number;
}

export function ReviewStep({
  formData,
  onChange,
  onClientChange,
  errors = {},
  totalOverride,
}: ReviewStepProps) {
  const isIncome = formData.type === "income";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center ${isIncome
            ? "bg-gradient-to-br from-green-500/15 to-green-500/5"
            : "bg-gradient-to-br from-red-500/15 to-red-500/5"
            }`}
        >
          {isIncome ? (
            <TrendingUp className="w-6 h-6 text-green-600" />
          ) : (
            <TrendingDown className="w-6 h-6 text-red-500" />
          )}
        </div>
        <div>
          <h3 className="text-lg font-semibold">Revisar e Confirmar</h3>
          <p className="text-sm text-muted-foreground">
            Verifique os dados antes de salvar
          </p>
        </div>
      </div>

      {/* Summary Card */}
      <div
        className={`rounded-2xl border-2 overflow-hidden ${isIncome ? "border-green-500/30" : "border-red-500/30"
          }`}
      >
        <div
          className={`px-6 py-4 ${isIncome
            ? "bg-gradient-to-r from-green-500/10 to-transparent"
            : "bg-gradient-to-r from-red-500/10 to-transparent"
            }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {isIncome ? "Receita" : "Despesa"}
              </p>
              <p className="font-semibold text-lg">
                {formData.description || "Sem descrição"}
              </p>
            </div>
            <div
              className={`text-right ${isIncome ? "text-green-600" : "text-red-500"}`}
            >
              <p className="text-sm">Valor Total</p>
              <p className="text-2xl font-bold">
                {isIncome ? "+" : "-"} {formatCurrency(totalOverride ?? parseFloat(formData.amount || "0"))}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4 bg-card">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Categoria:</span>
              <p className="font-medium">{formData.category || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Carteira:</span>
              <p className="font-medium">{formData.wallet || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Data:</span>
              <p className="font-medium">{formData.date || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span>
              <p className="font-medium capitalize">{formData.status}</p>
            </div>
          </div>

          {formData.isInstallment && (
            <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
              <p className="text-sm text-muted-foreground">Parcelamento</p>
              <p className="font-semibold">
                {formData.installmentCount}x de {formatCurrency(
                  totalOverride !== undefined
                    ? parseFloat(formData.amount || "0")
                    : (parseFloat(formData.amount || "0") / formData.installmentCount)
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Client */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-muted-foreground" />
          <Label className="text-sm font-medium">
            Cliente{" "}
            {isIncome && <span className="text-destructive">*</span>}
          </Label>
        </div>
        <ClientSelect
          value={formData.clientName}
          clientId={formData.clientId}
          onChange={onClientChange}
          error={!!errors.clientId || !!errors.clientName}
        />
        {(errors.clientId || errors.clientName) && (
          <p className="text-sm text-destructive">
            {errors.clientId || errors.clientName}
          </p>
        )}
      </div>

      {/* Notes */}
      <FormItem label="Observações" htmlFor="notes">
        <Textarea
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={onChange}
          placeholder="Anotações adicionais..."
          className="min-h-[80px]"
        />
      </FormItem>
    </div>
  );
}
