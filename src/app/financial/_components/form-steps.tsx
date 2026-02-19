"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { FormGroup, FormItem } from "@/components/ui/form-components";
import { FormErrors } from "@/hooks/useFormValidation";
import {
  TrendingUp,
  TrendingDown,
  FileText,
  Tag,
  Check,
} from "lucide-react";
import { TransactionFormData } from "../_hooks/useTransactionForm";
import { TransactionType } from "@/services/transaction-service";

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
            ${
              type === "income"
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
              ${
                type === "income"
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
            ${
              type === "expense"
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
              ${
                type === "expense"
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
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => void;
  errors?: FormErrors<TransactionFormData>;
  isProposalTransaction?: boolean;
  groupInfo?: {
    currentTotal: number;
    number: number;
    count: number;
  };
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

      <FormItem label="Data" htmlFor="date" required error={errors.date}>
        <DatePicker
          id="date"
          name="date"
          value={formData.date}
          onChange={onChange}
          onBlur={onBlur}
          className={errors.date ? "border-destructive" : ""}
          required
        />
      </FormItem>
    </div>
  );
}

// ============================================
// STEP 3: PAYMENT
// ============================================

export { PaymentStep } from './form-steps/payment-step';
export { ReviewStep } from './form-steps/review-step';

