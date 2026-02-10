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
  Wallet,
  Banknote,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { TransactionFormData, PaymentMode } from "../_hooks/useTransactionForm";
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
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => void;
  errors?: FormErrors<TransactionFormData>;
  isProposalTransaction?: boolean;
  onPaymentModeChange?: (mode: PaymentMode) => void;
}

export function PaymentStep({
  formData,
  onFormDataChange,
  onChange,
  onBlur,
  errors = {},
  isProposalTransaction = false,
  onPaymentModeChange,
}: PaymentStepProps) {
  // Calculate total based on mode
  const calculateTotal = (): number => {
    if (formData.paymentMode === "total") {
      return parseFloat(formData.amount || "0");
    } else {
      // installmentValue mode
      const installmentValue = parseFloat(formData.installmentValue || "0");
      const downPayment = formData.downPaymentEnabled
        ? parseFloat(formData.downPaymentValue || "0")
        : 0;
      return installmentValue * (formData.installmentCount || 1) + downPayment;
    }
  };

  // Calculate installment value when in total mode (now accounts for down payment)
  const getInstallmentValueFromTotal = (): string => {
    const total = parseFloat(formData.amount || "0");
    const downPayment = formData.downPaymentEnabled
      ? parseFloat(formData.downPaymentValue || "0")
      : 0;
    const remaining = total - downPayment;
    const count = formData.installmentCount || 1;
    if (remaining <= 0 || count <= 0) return "0,00";
    return (remaining / count).toFixed(2);
  };

  const handlePaymentModeChange = (mode: PaymentMode) => {
    if (onPaymentModeChange) {
      onPaymentModeChange(mode);
    } else {
      onFormDataChange((prev) => ({
        ...prev,
        paymentMode: mode,
      }));
    }
  };

  const handlePaymentToggle = (field: string, value: boolean) => {
    onFormDataChange((prev) => ({
      ...prev,
      [field]: value,
      ...(field === "downPaymentEnabled" && !value
        ? {
            downPaymentValue: "",
            downPaymentWallet: "",
            downPaymentDueDate: "",
          }
        : {}),
    }));
  };

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

      {/* Payment Mode Selector */}
      {!isProposalTransaction && (
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => handlePaymentModeChange("total")}
            className={`
              relative rounded-xl border-2 p-4 transition-all duration-300 cursor-pointer text-left
              ${
                formData.paymentMode === "total"
                  ? "border-primary bg-primary/5 shadow-md"
                  : "border-border/50 bg-card hover:border-primary/30"
              }
            `}
          >
            {formData.paymentMode === "total" && (
              <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  formData.paymentMode === "total"
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold">Valor total</p>
                <p className="text-xs text-muted-foreground">
                  Informe o valor e parcele
                </p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handlePaymentModeChange("installmentValue")}
            className={`
              relative rounded-xl border-2 p-4 transition-all duration-300 cursor-pointer text-left
              ${
                formData.paymentMode === "installmentValue"
                  ? "border-primary bg-primary/5 shadow-md"
                  : "border-border/50 bg-card hover:border-primary/30"
              }
            `}
          >
            {formData.paymentMode === "installmentValue" && (
              <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  formData.paymentMode === "installmentValue"
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold">Valor das parcelas</p>
                <p className="text-xs text-muted-foreground">
                  Defina parcelas e entrada
                </p>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* ================== MODE: VALOR TOTAL ================== */}
      {formData.paymentMode === "total" && (
        <div className="space-y-3 animate-in fade-in duration-300">
          {/* Amount Input */}
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
              disabled={isProposalTransaction}
            />
            {isProposalTransaction && (
              <p className="text-xs text-muted-foreground mt-1">
                Valor gerenciado pela Proposta. Para alterar, edite a proposta.
              </p>
            )}
          </FormItem>

          {/* Due Date Input - HIDDEN if installments enabled */}
          {!formData.isInstallment && (
            <FormItem
              label="Vencimento (Valor à Vista)"
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
          )}

          {/* Wallet Select */}
          <div className="space-y-2">
            <WalletSelect
              label="Carteira / Método"
              name="wallet"
              value={formData.wallet}
              onChange={onChange}
              required
              error={errors.wallet}
            />
          </div>

          {isProposalTransaction && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm text-blue-600">
              As condições de pagamento são gerenciadas pela Proposta. Para
              alterar parcelamento, edite a Proposta original.
            </div>
          )}

          {/* Down Payment Toggle - Compact */}
          {!isProposalTransaction && (
            <div
              className={`
              rounded-xl border p-4 transition-all duration-200
              ${
                formData.downPaymentEnabled
                  ? "border-blue-500/40 bg-blue-500/5"
                  : "border-border hover:border-blue-500/30"
              }
            `}
            >
              <label
                htmlFor="downPaymentEnabledTotal"
                className="flex items-center gap-3 cursor-pointer"
              >
                <div
                  className={`
                  w-8 h-8 rounded-lg flex items-center justify-center transition-all
                  ${formData.downPaymentEnabled ? "bg-blue-500/15 text-blue-500" : "bg-muted text-muted-foreground"}
                `}
                >
                  <Banknote className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">Incluir Entrada</p>
                  <p className="text-xs text-muted-foreground">
                    Valor à vista antes das parcelas
                  </p>
                </div>
                <Checkbox
                  id="downPaymentEnabledTotal"
                  checked={formData.downPaymentEnabled || false}
                  onCheckedChange={(checked) =>
                    handlePaymentToggle(
                      "downPaymentEnabled",
                      checked as boolean,
                    )
                  }
                  className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500 cursor-pointer"
                />
              </label>

              {formData.downPaymentEnabled && (
                <div className="space-y-3 pt-4 mt-4 border-t border-border/30 animate-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between h-7">
                        <Label
                          htmlFor="downPaymentValueTotal"
                          className="text-sm font-medium"
                        >
                          Valor da Entrada
                        </Label>
                      </div>
                      <CurrencyInput
                        id="downPaymentValueTotal"
                        name="downPaymentValue"
                        value={formData.downPaymentValue || ""}
                        onChange={onChange}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="space-y-2">
                      <WalletSelect
                        label="Carteira"
                        name="downPaymentWallet"
                        value={formData.downPaymentWallet || ""}
                        onChange={onChange}
                        preSelectDefault
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="downPaymentDueDateTotal"
                      className="text-sm font-medium"
                    >
                      Data da Entrada
                    </Label>
                    <Input
                      type="date"
                      id="downPaymentDueDateTotal"
                      name="downPaymentDueDate"
                      value={formData.downPaymentDueDate || ""}
                      onChange={onChange}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Installments Toggle - Compact */}
          <div
            className={`
            rounded-xl border p-4 transition-all duration-200
            ${
              formData.isInstallment
                ? "border-primary/40 bg-primary/5"
                : "border-border hover:border-primary/30"
            }
          `}
          >
            <label
              htmlFor="isInstallment"
              className="flex items-center gap-3 cursor-pointer"
            >
              <div
                className={`
                w-8 h-8 rounded-lg flex items-center justify-center transition-all
                ${formData.isInstallment ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}
              `}
              >
                <Calendar className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Parcelar Lançamento</p>
                <p className="text-xs text-muted-foreground">
                  Divida em múltiplas parcelas
                </p>
              </div>
              <Checkbox
                id="isInstallment"
                checked={formData.isInstallment}
                onCheckedChange={(checked) =>
                  onChange({
                    target: {
                      name: "isInstallment",
                      type: "checkbox",
                      checked: checked === true,
                    },
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  } as any)
                }
                disabled={isProposalTransaction}
                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary cursor-pointer"
              />
            </label>

            {formData.isInstallment && (
              <div className="grid grid-cols-2 gap-4 pt-4 mt-4 border-t border-border/30 animate-in slide-in-from-top-2 duration-200">
                <FormItem label="Parcelas" htmlFor="installmentCount">
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
                </FormItem>

                <FormItem label="Valor/Parcela">
                  <div className="h-11 px-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-primary">
                      R$ {getInstallmentValueFromTotal()}
                    </span>
                  </div>
                </FormItem>

                <FormItem
                  label="Vencimento da 1ª Parcela"
                  htmlFor="dueDateInstallment"
                  className="col-span-2"
                  required={formData.type === "income"}
                  error={errors.dueDate}
                >
                  <DateInput
                    id="dueDateInstallment"
                    name="dueDate"
                    value={formData.dueDate}
                    onChange={onChange}
                    onBlur={onBlur}
                    className={errors.dueDate ? "border-destructive" : ""}
                    required={formData.type === "income"}
                  />
                </FormItem>
              </div>
            )}
          </div>

          {/* Payment Summary - shows when both down payment and installments are configured */}
          {formData.downPaymentEnabled &&
            formData.downPaymentValue &&
            parseFloat(formData.downPaymentValue) > 0 &&
            formData.isInstallment && (
              <div className="p-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-semibold">Resumo do Pagamento</span>
                </div>
                <div className="text-sm space-y-2">
                  <div className="flex justify-between items-center py-1 border-b border-border/30">
                    <span className="text-muted-foreground">Valor Total:</span>
                    <span className="font-semibold">
                      {formatCurrency(parseFloat(formData.amount || "0"))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-blue-500">• Entrada:</span>
                    <span className="font-semibold text-blue-500">
                      {formatCurrency(
                        parseFloat(formData.downPaymentValue || "0"),
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-primary">• Parcelas:</span>
                    <span className="font-semibold text-primary">
                      {formData.installmentCount || 1}x de R${" "}
                      {getInstallmentValueFromTotal()}
                    </span>
                  </div>
                </div>
              </div>
            )}
        </div>
      )}

      {/* ================== MODE: VALOR DAS PARCELAS ================== */}
      {formData.paymentMode === "installmentValue" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Down Payment Toggle - Compact (Advanced Mode) */}
          <div
            className={`
            rounded-xl border p-4 transition-all duration-200
            ${
              formData.downPaymentEnabled
                ? "border-blue-500/40 bg-blue-500/5"
                : "border-border hover:border-blue-500/30"
            }
          `}
          >
            <label
              htmlFor="downPaymentEnabledAdvanced"
              className="flex items-center gap-3 cursor-pointer"
            >
              <div
                className={`
                w-8 h-8 rounded-lg flex items-center justify-center transition-all
                ${formData.downPaymentEnabled ? "bg-blue-500/15 text-blue-500" : "bg-muted text-muted-foreground"}
              `}
              >
                <Banknote className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Incluir Entrada</p>
                <p className="text-xs text-muted-foreground">
                  Valor à vista antes das parcelas
                </p>
              </div>
              <Checkbox
                id="downPaymentEnabledAdvanced"
                checked={formData.downPaymentEnabled || false}
                onCheckedChange={(checked) =>
                  handlePaymentToggle("downPaymentEnabled", checked as boolean)
                }
                className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500 cursor-pointer"
              />
            </label>

            {formData.downPaymentEnabled && (
              <div className="space-y-3 pt-4 mt-4 border-t border-border/30 animate-in slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between h-7">
                      <Label
                        htmlFor="downPaymentValueAdvanced"
                        className="text-sm font-medium"
                      >
                        Valor da Entrada
                      </Label>
                    </div>
                    <CurrencyInput
                      id="downPaymentValueAdvanced"
                      name="downPaymentValue"
                      value={formData.downPaymentValue || ""}
                      onChange={onChange}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <WalletSelect
                      label="Carteira"
                      name="downPaymentWallet"
                      value={formData.downPaymentWallet || ""}
                      onChange={onChange}
                      preSelectDefault
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="downPaymentDueDateAdvanced"
                    className="text-sm font-medium"
                  >
                    Data da Entrada
                  </Label>
                  <Input
                    type="date"
                    id="downPaymentDueDateAdvanced"
                    name="downPaymentDueDate"
                    value={formData.downPaymentDueDate || ""}
                    onChange={onChange}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Parcelamento Section */}
          <div className="space-y-4">
            <label
              htmlFor="installmentsEnabledAdvanced"
              className="flex items-center gap-3 p-4 rounded-xl border-2 border-transparent hover:border-primary/20 hover:bg-primary/5 transition-all cursor-pointer group bg-muted/30"
            >
              <div
                className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                  formData.isInstallment
                    ? "bg-primary border-primary"
                    : "border-muted-foreground/40 group-hover:border-primary/60"
                }`}
              >
                {formData.isInstallment && (
                  <svg
                    className="w-4 h-4 text-primary-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>
              <input
                type="checkbox"
                id="installmentsEnabledAdvanced"
                checked={formData.isInstallment}
                onChange={(e) =>
                  handlePaymentToggle("isInstallment", e.target.checked)
                }
                className="sr-only"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-base">Parcelamento</span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Divida o valor em parcelas mensais
                </p>
              </div>
            </label>

            {formData.isInstallment && (
              <div className="ml-4 pl-4 border-l-2 border-primary/20 space-y-5">
                {/* Installment Configuration */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="installmentCountAdvanced">
                      Número de Parcelas
                    </Label>
                    <Input
                      id="installmentCountAdvanced"
                      name="installmentCount"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="Ex: 12"
                      value={formData.installmentCount || ""}
                      onChange={(e) => {
                        const value =
                          e.target.value === "" ? 0 : parseInt(e.target.value);
                        onFormDataChange((prev) => ({
                          ...prev,
                          installmentCount: isNaN(value) ? 0 : value,
                        }));
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="installmentValue">Valor por Parcela</Label>
                    <CurrencyInput
                      id="installmentValue"
                      name="installmentValue"
                      value={formData.installmentValue}
                      onChange={onChange}
                      placeholder="0,00"
                    />
                  </div>
                </div>

                {/* Installments Wallet */}
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1">
                    <WalletSelect
                      label="Carteira para parcelas (interno)"
                      name="installmentsWallet"
                      value={formData.installmentsWallet || ""}
                      onChange={onChange}
                      preSelectDefault
                    />
                  </div>
                </div>

                {/* First Installment Date */}
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1">
                    <Label htmlFor="firstInstallmentDate">
                      Vencimento da 1ª Parcela
                    </Label>
                    <Input
                      type="date"
                      id="firstInstallmentDate"
                      name="firstInstallmentDate"
                      value={formData.firstInstallmentDate || ""}
                      onChange={onChange}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Demais parcelas: +30 dias cada
                    </p>
                  </div>
                </div>

                {/* Summary */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-primary" />
                    </div>
                    <span className="font-semibold">Resumo do Pagamento</span>
                  </div>
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between items-center py-1 border-b border-border/30">
                      <span className="text-muted-foreground">
                        Total do Lançamento:
                      </span>
                      <span className="font-semibold">
                        {formatCurrency(calculateTotal())}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-primary">• Parcelas:</span>
                      <span className="font-semibold text-primary">
                        {formData.installmentCount || 1}x de{" "}
                        {formatCurrency(
                          parseFloat(formData.installmentValue || "0"),
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* No installments - Show single payment info */}
          {!formData.isInstallment && (
            <div className="p-4 rounded-xl bg-muted/30 border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Pagamento à Vista</p>
                  <p className="text-sm text-muted-foreground">
                    Marque &quot;Parcelamento&quot; para configurar as parcelas
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
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

  // Calculate total based on payment mode
  const calculateDisplayTotal = () => {
    if (totalOverride !== undefined) return totalOverride;

    if (formData.paymentMode === "installmentValue") {
      const installmentValue = parseFloat(formData.installmentValue || "0");
      const installmentCount = formData.installmentCount || 1;
      const downPayment = formData.downPaymentEnabled
        ? parseFloat(formData.downPaymentValue || "0")
        : 0;
      return installmentValue * installmentCount + downPayment;
    }

    return parseFloat(formData.amount || "0");
  };

  const displayTotal = calculateDisplayTotal();

  // Get installment value for display
  const getInstallmentDisplayValue = () => {
    if (formData.paymentMode === "installmentValue") {
      return parseFloat(formData.installmentValue || "0");
    }

    // Total mode
    const total = parseFloat(formData.amount || "0");
    const downPayment = formData.downPaymentEnabled
      ? parseFloat(formData.downPaymentValue || "0")
      : 0;
    const remaining = total - downPayment;

    // Avoid division by zero
    if (formData.installmentCount === 0) return 0;

    return remaining / formData.installmentCount;
  };

  // Get wallet display
  const getWalletDisplay = () => {
    if (formData.paymentMode === "installmentValue") {
      return formData.installmentsWallet || formData.wallet || "—";
    }
    return formData.wallet || "—";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            isIncome
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
        className={`rounded-2xl border-2 overflow-hidden ${
          isIncome ? "border-green-500/30" : "border-red-500/30"
        }`}
      >
        <div
          className={`px-6 py-4 ${
            isIncome
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
                {isIncome ? "+" : "-"} {formatCurrency(displayTotal)}
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
              <p className="font-medium">{getWalletDisplay()}</p>
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

          {/* Payment Structure Breakdown */}
          {(formData.isInstallment || formData.downPaymentEnabled) && (
            <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-3">
              {/* Down Payment */}
              {formData.downPaymentEnabled && (
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-sm font-medium text-blue-500">
                      Entrada
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Valor pago à vista
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-blue-500">
                      {formatCurrency(
                        parseFloat(formData.downPaymentValue || "0"),
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formData.downPaymentDueDate
                        ? new Date(
                            formData.downPaymentDueDate + "T12:00:00",
                          ).toLocaleDateString("pt-BR")
                        : "Data não definida"}
                    </p>
                  </div>
                </div>
              )}

              {/* Installments */}
              {formData.isInstallment && (
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-sm font-medium text-primary">
                      Parcelamento
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {formData.installmentCount} parcelas mensais
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-primary">
                      {formData.installmentCount}x de{" "}
                      {formatCurrency(getInstallmentDisplayValue())}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      1ª:{" "}
                      {formData.firstInstallmentDate
                        ? new Date(
                            formData.firstInstallmentDate + "T12:00:00",
                          ).toLocaleDateString("pt-BR")
                        : formData.dueDate
                          ? new Date(
                              formData.dueDate + "T12:00:00",
                            ).toLocaleDateString("pt-BR")
                          : "Data não definida"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Client */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-muted-foreground" />
          <Label className="text-sm font-medium">
            {isIncome ? "Cliente" : "Fornecedor"}{" "}
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
