"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePicker } from "@/components/ui/date-picker";
import { WalletSelect } from "@/components/features/wallet-select";
import { FormItem } from "@/components/ui/form-components";
import { formatCurrency } from "@/utils/format";
import { FormErrors } from "@/hooks/useFormValidation";
import {
  CreditCard,
  Calendar,
  DollarSign,
  Wallet,
  Banknote,
  Check,
  RefreshCw,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  TransactionFormData,
  PaymentMode,
} from "../../_hooks/useTransactionForm";
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
  const getDownPaymentAmount = () => {
    if (!formData.downPaymentEnabled) return 0;

    if (formData.downPaymentType === "percentage") {
      const baseTotal =
        formData.paymentMode === "installmentValue"
          ? parseFloat(formData.installmentValue || "0") *
            (formData.installmentCount || 1)
          : parseFloat(formData.amount || "0");

      return (
        (baseTotal * parseFloat(formData.downPaymentPercentage || "0")) / 100
      );
    }

    return parseFloat(formData.downPaymentValue || "0");
  };

  // Calculate total based on mode
  const calculateTotal = (): number => {
    if (formData.paymentMode === "total") {
      return parseFloat(formData.amount || "0");
    } else {
      // installmentValue mode
      const installmentValue = parseFloat(formData.installmentValue || "0");
      const downPayment = getDownPaymentAmount();
      return installmentValue * (formData.installmentCount || 1) + downPayment;
    }
  };

  // Calculate installment value when in total mode (now accounts for down payment)
  const getInstallmentValueFromTotal = (): string => {
    const total = parseFloat(formData.amount || "0");
    const downPayment = getDownPaymentAmount();
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
    onFormDataChange((prev) => {
      const updates: Partial<TransactionFormData> = {
        [field as keyof TransactionFormData]: value as never,
      };

      if (field === "isInstallment" && value) {
        updates.isRecurring = false;
      }
      if (field === "isRecurring" && value) {
        updates.isInstallment = false;
        updates.installmentCount = 1;
      }

      if (field === "downPaymentEnabled" && !value) {
        updates.downPaymentType = "value";
        updates.downPaymentPercentage = "";
        updates.downPaymentValue = "";
        updates.downPaymentWallet = "";
        updates.downPaymentDueDate = "";
      }

      return { ...prev, ...updates };
    });
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

          {/* Due Date Input - HIDDEN if installments or recurring enabled */}
          {!formData.isInstallment && !formData.isRecurring && (
            <FormItem
              label="Vencimento (Valor à Vista)"
              htmlFor="dueDate"
              required={formData.type === "income"}
              error={errors.dueDate}
            >
              <DatePicker
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
          <div className="field-gap">
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
              <div
                className="flex items-center gap-3 cursor-pointer"
                onClick={() =>
                  handlePaymentToggle(
                    "downPaymentEnabled",
                    !formData.downPaymentEnabled,
                  )
                }
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
                <div onClick={(e) => e.stopPropagation()}>
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
                </div>
              </div>

              {formData.downPaymentEnabled && (
                <div className="space-y-3 pt-4 mt-4 border-t border-border/30 animate-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="field-gap">
                      <div className="min-h-5">
                        <Label
                          htmlFor="downPaymentTypeTotal"
                          className="text-sm font-medium"
                        >
                          Tipo da Entrada
                        </Label>
                      </div>
                      <Select
                        id="downPaymentTypeTotal"
                        name="downPaymentType"
                        value={formData.downPaymentType || "value"}
                        onChange={onChange}
                      >
                        <option value="value">Valor</option>
                        <option value="percentage">Porcentagem</option>
                      </Select>
                    </div>
                    <div className="field-gap">
                      <WalletSelect
                        label="Carteira"
                        name="downPaymentWallet"
                        value={formData.downPaymentWallet || ""}
                        onChange={onChange}
                        preSelectDefault
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                    <div className="field-gap">
                      <div className="min-h-5">
                        <Label
                          htmlFor={
                            formData.downPaymentType === "percentage"
                              ? "downPaymentPercentageTotal"
                              : "downPaymentValueTotal"
                          }
                          className={`text-sm font-medium ${
                            formData.downPaymentType === "percentage"
                              ? errors.downPaymentPercentage
                                ? "text-destructive"
                                : ""
                              : errors.downPaymentValue
                                ? "text-destructive"
                                : ""
                          }`}
                        >
                          {formData.downPaymentType === "percentage"
                            ? "Porcentagem da Entrada"
                            : "Valor da Entrada"}
                        </Label>
                      </div>
                      {formData.downPaymentType === "percentage" ? (
                        <div className="space-y-4">
                          <Input
                            id="downPaymentPercentageTotal"
                            name="downPaymentPercentage"
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            value={formData.downPaymentPercentage || ""}
                            onChange={onChange}
                            placeholder="0"
                            suffix={<span className="text-sm">%</span>}
                            className={`w-full ${errors.downPaymentPercentage ? "border-destructive focus-visible:ring-destructive" : ""}`}
                          />
                          {errors.downPaymentPercentage && (
                            <p className="text-xs text-destructive mt-1">
                              {errors.downPaymentPercentage}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Valor calculado:{" "}
                            {formatCurrency(getDownPaymentAmount())}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <CurrencyInput
                            id="downPaymentValueTotal"
                            name="downPaymentValue"
                            value={formData.downPaymentValue || ""}
                            onChange={onChange}
                            placeholder="0,00"
                            className={
                              errors.downPaymentValue
                                ? "border-destructive focus-visible:ring-destructive"
                                : ""
                            }
                          />
                          {errors.downPaymentValue && (
                            <p className="text-xs text-destructive mt-1">
                              {errors.downPaymentValue}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="field-gap">
                      <div className="min-h-5">
                        <Label
                          htmlFor="downPaymentDueDateTotal"
                          className={`text-sm font-medium ${errors.downPaymentDueDate ? "text-destructive" : ""}`}
                        >
                          Data da Entrada
                        </Label>
                      </div>
                      <DatePicker
                        id="downPaymentDueDateTotal"
                        name="downPaymentDueDate"
                        value={formData.downPaymentDueDate || ""}
                        onChange={onChange}
                        className={
                          errors.downPaymentDueDate
                            ? "border-destructive focus-visible:ring-destructive"
                            : ""
                        }
                      />
                      {errors.downPaymentDueDate && (
                        <p className="text-xs text-destructive mt-1">
                          {errors.downPaymentDueDate}
                        </p>
                      )}
                    </div>
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
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() =>
                handlePaymentToggle("isInstallment", !formData.isInstallment)
              }
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
              <div onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  id="isInstallment"
                  checked={formData.isInstallment}
                  onCheckedChange={(checked) =>
                    handlePaymentToggle("isInstallment", checked === true)
                  }
                  disabled={isProposalTransaction}
                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary cursor-pointer"
                />
              </div>
            </div>

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

                <FormItem
                  label="Intervalo (meses)"
                  htmlFor="installmentInterval"
                >
                  <Input
                    id="installmentInterval"
                    name="installmentInterval"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="Ex: 1"
                    value={formData.installmentInterval || ""}
                    onChange={(e) => {
                      const value =
                        e.target.value === "" ? 0 : parseInt(e.target.value);
                      onFormDataChange((prev) => ({
                        ...prev,
                        installmentInterval: isNaN(value) ? 1 : value,
                      }));
                    }}
                  />
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
                  required={formData.type === "income"}
                  error={errors.dueDate}
                >
                  <DatePicker
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

          {/* Recurring Toggle - Compact */}
          <div
            className={`
            rounded-xl border p-4 transition-all duration-200 mt-4
            ${
              formData.isRecurring
                ? "border-green-500/40 bg-green-500/5"
                : "border-border hover:border-green-500/30"
            }
          `}
          >
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() =>
                handlePaymentToggle("isRecurring", !formData.isRecurring)
              }
            >
              <div
                className={`
                w-8 h-8 rounded-lg flex items-center justify-center transition-all
                ${formData.isRecurring ? "bg-green-500/15 text-green-500" : "bg-muted text-muted-foreground"}
              `}
              >
                <RefreshCw className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Pagamento Recorrente</p>
                <p className="text-xs text-muted-foreground">
                  Gera lançamentos contínuos automatizados
                </p>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  id="isRecurring"
                  checked={formData.isRecurring}
                  onCheckedChange={(checked) =>
                    handlePaymentToggle("isRecurring", checked === true)
                  }
                  disabled={isProposalTransaction}
                  className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500 cursor-pointer"
                />
              </div>
            </div>

            {formData.isRecurring && (
              <div className="pt-4 mt-4 border-t border-border/30 animate-in slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-2 gap-4">
                  <FormItem
                    label="Vencimento da 1ª Recorrência"
                    htmlFor="dueDateRecurring"
                    required={formData.type === "income"}
                    error={errors.dueDate}
                  >
                    <DatePicker
                      id="dueDateRecurring"
                      name="dueDate"
                      value={formData.dueDate}
                      onChange={onChange}
                      onBlur={onBlur}
                      className={errors.dueDate ? "border-destructive" : ""}
                      required={formData.type === "income"}
                    />
                  </FormItem>

                  <FormItem
                    label="Repetir a cada (x meses)"
                    htmlFor="recurringInterval"
                  >
                    <Input
                      id="recurringInterval"
                      name="recurringInterval"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="Ex: 1"
                      value={formData.installmentInterval || ""}
                      onChange={(e) => {
                        const value =
                          e.target.value === "" ? 0 : parseInt(e.target.value);
                        onFormDataChange((prev) => ({
                          ...prev,
                          installmentInterval: isNaN(value) ? 1 : value,
                        }));
                      }}
                    />
                  </FormItem>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Lançamentos gerados automaticamente a partir da data
                  informada, no intervalo selecionado.
                </p>
              </div>
            )}
          </div>

          {/* Payment Summary - shows when both down payment and installments are configured */}
          {formData.downPaymentEnabled &&
            getDownPaymentAmount() > 0 &&
            (formData.isInstallment || formData.isRecurring) && (
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
                      {formatCurrency(getDownPaymentAmount())}
                      {formData.downPaymentType === "percentage"
                        ? ` (${parseFloat(formData.downPaymentPercentage || "0").toFixed(2)}%)`
                        : ""}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-primary">
                      {formData.isRecurring ? "• Recorrência:" : "• Parcelas:"}
                    </span>
                    <span className="font-semibold text-primary">
                      {formData.isRecurring
                        ? `R$ ${getInstallmentValueFromTotal()} / período`
                        : `${formData.installmentCount || 1}x de R$ ${getInstallmentValueFromTotal()}`}
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
                  <div className="field-gap">
                    <div className="min-h-5">
                      <Label
                        htmlFor="downPaymentTypeAdvanced"
                        className="text-sm font-medium"
                      >
                        Tipo da Entrada
                      </Label>
                    </div>
                    <Select
                      id="downPaymentTypeAdvanced"
                      name="downPaymentType"
                      value={formData.downPaymentType || "value"}
                      onChange={onChange}
                    >
                      <option value="value">Valor</option>
                      <option value="percentage">Porcentagem</option>
                    </Select>
                  </div>
                  <div className="field-gap">
                    <WalletSelect
                      label="Carteira"
                      name="downPaymentWallet"
                      value={formData.downPaymentWallet || ""}
                      onChange={onChange}
                      preSelectDefault
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                  <div className="field-gap">
                    <div className="min-h-5">
                      <Label
                        htmlFor={
                          formData.downPaymentType === "percentage"
                            ? "downPaymentPercentageAdvanced"
                            : "downPaymentValueAdvanced"
                        }
                        className={`text-sm font-medium ${
                          formData.downPaymentType === "percentage"
                            ? errors.downPaymentPercentage
                              ? "text-destructive"
                              : ""
                            : errors.downPaymentValue
                              ? "text-destructive"
                              : ""
                        }`}
                      >
                        {formData.downPaymentType === "percentage"
                          ? "Porcentagem da Entrada"
                          : "Valor da Entrada"}
                      </Label>
                    </div>
                    {formData.downPaymentType === "percentage" ? (
                      <div className="space-y-4">
                        <Input
                          id="downPaymentPercentageAdvanced"
                          name="downPaymentPercentage"
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          value={formData.downPaymentPercentage || ""}
                          onChange={onChange}
                          placeholder="0"
                          suffix={<span className="text-sm">%</span>}
                          className={`w-full ${errors.downPaymentPercentage ? "border-destructive focus-visible:ring-destructive" : ""}`}
                        />
                        {errors.downPaymentPercentage && (
                          <p className="text-xs text-destructive mt-1">
                            {errors.downPaymentPercentage}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Valor calculado:{" "}
                          {formatCurrency(getDownPaymentAmount())}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <CurrencyInput
                          id="downPaymentValueAdvanced"
                          name="downPaymentValue"
                          value={formData.downPaymentValue || ""}
                          onChange={onChange}
                          placeholder="0,00"
                          className={
                            errors.downPaymentValue
                              ? "border-destructive focus-visible:ring-destructive"
                              : ""
                          }
                        />
                        {errors.downPaymentValue && (
                          <p className="text-xs text-destructive mt-1">
                            {errors.downPaymentValue}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="field-gap">
                    <div className="min-h-5">
                      <Label
                        htmlFor="downPaymentDueDateAdvanced"
                        className={`text-sm font-medium ${errors.downPaymentDueDate ? "text-destructive" : ""}`}
                      >
                        Data da Entrada
                      </Label>
                    </div>
                    <DatePicker
                      id="downPaymentDueDateAdvanced"
                      name="downPaymentDueDate"
                      value={formData.downPaymentDueDate || ""}
                      onChange={onChange}
                      className={
                        errors.downPaymentDueDate
                          ? "border-destructive focus-visible:ring-destructive"
                          : ""
                      }
                    />
                    {errors.downPaymentDueDate && (
                      <p className="text-xs text-destructive mt-1">
                        {errors.downPaymentDueDate}
                      </p>
                    )}
                  </div>
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
                  <div className="field-gap">
                    <div className="min-h-5">
                      <Label htmlFor="installmentCountAdvanced">
                        Número de Parcelas
                      </Label>
                    </div>
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

                  <div className="field-gap">
                    <div className="min-h-5">
                      <Label htmlFor="installmentIntervalAdvanced">
                        Intervalo (meses)
                      </Label>
                    </div>
                    <Input
                      id="installmentIntervalAdvanced"
                      name="installmentInterval"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="Ex: 1"
                      value={formData.installmentInterval || ""}
                      onChange={(e) => {
                        const value =
                          e.target.value === "" ? 0 : parseInt(e.target.value);
                        onFormDataChange((prev) => ({
                          ...prev,
                          installmentInterval: isNaN(value) ? 1 : value,
                        }));
                      }}
                    />
                  </div>

                  <div className="field-gap">
                    <div className="min-h-5">
                      <Label htmlFor="installmentValue">
                        Valor por Parcela
                      </Label>
                    </div>
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
                <div className="flex items-end gap-2">
                  <div className="h-11 flex items-center">
                    <Wallet className="w-4 h-4 text-muted-foreground" />
                  </div>
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
                  <Calendar
                    className={`w-4 h-4 ${errors.firstInstallmentDate ? "text-destructive" : "text-muted-foreground"}`}
                  />
                  <div className="flex-1 field-gap">
                    <div className="min-h-5">
                      <Label
                        htmlFor="firstInstallmentDate"
                        className={
                          errors.firstInstallmentDate ? "text-destructive" : ""
                        }
                      >
                        Vencimento da 1ª Parcela
                      </Label>
                    </div>
                    <DatePicker
                      id="firstInstallmentDate"
                      name="firstInstallmentDate"
                      value={formData.firstInstallmentDate || ""}
                      onChange={onChange}
                      className={
                        errors.firstInstallmentDate
                          ? "border-destructive focus-visible:ring-destructive"
                          : ""
                      }
                    />
                    {errors.firstInstallmentDate ? (
                      <p className="text-xs text-destructive mt-1">
                        {errors.firstInstallmentDate}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">
                        Demais parcelas: +30 dias cada
                      </p>
                    )}
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

          {/* Recurring Toggle - Compact (Advanced Mode) */}
          <div
            className={`
            rounded-xl border p-4 transition-all duration-200 mt-4
            ${
              formData.isRecurring
                ? "border-green-500/40 bg-green-500/5"
                : "border-border hover:border-green-500/30"
            }
          `}
          >
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() =>
                handlePaymentToggle("isRecurring", !formData.isRecurring)
              }
            >
              <div
                className={`
                w-8 h-8 rounded-lg flex items-center justify-center transition-all
                ${formData.isRecurring ? "bg-green-500/15 text-green-500" : "bg-muted text-muted-foreground"}
              `}
              >
                <RefreshCw className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Pagamento Recorrente</p>
                <p className="text-xs text-muted-foreground">
                  Gera lançamentos contínuos automatizados
                </p>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  id="isRecurringAdvanced"
                  checked={formData.isRecurring}
                  onCheckedChange={(checked) =>
                    handlePaymentToggle("isRecurring", checked === true)
                  }
                  disabled={isProposalTransaction}
                  className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500 cursor-pointer"
                />
              </div>
            </div>

            {formData.isRecurring && (
              <div className="pt-4 mt-4 border-t border-border/30 animate-in slide-in-from-top-2 duration-200 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="field-gap">
                    <div className="min-h-5">
                      <Label
                        htmlFor="dueDateRecurringAdvanced"
                        className={
                          errors.firstInstallmentDate ? "text-destructive" : ""
                        }
                      >
                        Vencimento da 1ª Recorrência
                      </Label>
                    </div>
                    <DatePicker
                      id="dueDateRecurringAdvanced"
                      name="firstInstallmentDate"
                      value={formData.firstInstallmentDate}
                      onChange={onChange}
                      onBlur={onBlur}
                      className={
                        errors.firstInstallmentDate
                          ? "border-destructive focus-visible:ring-destructive"
                          : ""
                      }
                      required={formData.type === "income"}
                    />
                    {errors.firstInstallmentDate && (
                      <p className="text-xs text-destructive mt-1">
                        {errors.firstInstallmentDate}
                      </p>
                    )}
                  </div>

                  <div className="field-gap">
                    <div className="min-h-5">
                      <Label htmlFor="recurringIntervalAdvanced">
                        Repetir a cada (x meses)
                      </Label>
                    </div>
                    <Input
                      id="recurringIntervalAdvanced"
                      name="recurringInterval"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="Ex: 1"
                      value={formData.installmentInterval || ""}
                      onChange={(e) => {
                        const value =
                          e.target.value === "" ? 0 : parseInt(e.target.value);
                        onFormDataChange((prev) => ({
                          ...prev,
                          installmentInterval: isNaN(value) ? 1 : value,
                        }));
                      }}
                    />
                  </div>
                </div>

                <div className="field-gap">
                  <div className="min-h-5">
                    <Label htmlFor="recurringValueAdvanced">
                      Valor por Recorrência
                    </Label>
                  </div>
                  <CurrencyInput
                    id="recurringValueAdvanced"
                    name="installmentValue"
                    value={formData.installmentValue}
                    onChange={onChange}
                    placeholder="0,00"
                  />
                </div>

                <div className="flex items-end gap-2">
                  <div className="h-11 flex items-center">
                    <Wallet className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <WalletSelect
                      label="Carteira para recorrências"
                      name="installmentsWallet"
                      value={formData.installmentsWallet || ""}
                      onChange={onChange}
                      preSelectDefault
                    />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mt-2">
                  Lançamentos gerados automaticamente a partir da data
                  informada, no intervalo selecionado.
                </p>

                {/* Summary */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-primary" />
                    </div>
                    <span className="font-semibold">Resumo da Recorrência</span>
                  </div>
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between items-center py-1">
                      <span className="text-primary">• Valor por período:</span>
                      <span className="font-semibold text-primary">
                        {formatCurrency(
                          parseFloat(formData.installmentValue || "0"),
                        )}{" "}
                        / período
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* No installments or recurring - Show single payment info */}
          {!formData.isInstallment && !formData.isRecurring && (
            <div className="p-4 rounded-xl bg-muted/30 border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Pagamento à Vista</p>
                  <p className="text-sm text-muted-foreground">
                    Marque &quot;Parcelamento&quot; ou &quot;Recorrente&quot;
                    para configurar.
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
