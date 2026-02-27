"use client";

import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ClientSelect } from "@/components/features/client-select";
import { FormItem } from "@/components/ui/form-components";
import { formatCurrency } from "@/utils/format";
import { FormErrors } from "@/hooks/useFormValidation";
import { TrendingUp, TrendingDown, User } from "lucide-react";
import { TransactionFormData } from "../../_hooks/useTransactionForm";
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

  // Calculate total based on payment mode
  const calculateDisplayTotal = () => {
    if (totalOverride !== undefined) return totalOverride;

    if (formData.paymentMode === "installmentValue") {
      const installmentValue = parseFloat(formData.installmentValue || "0");
      const installmentCount = formData.installmentCount || 1;
      const downPayment = getDownPaymentAmount();
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
    const downPayment = getDownPaymentAmount();
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
              <p className="font-semibold text-lg text-balance break-words pr-2">
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
                      {formatCurrency(getDownPaymentAmount())}
                      {formData.downPaymentType === "percentage"
                        ? ` (${parseFloat(formData.downPaymentPercentage || "0").toFixed(2)}%)`
                        : ""}
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
                      {formData.paymentMode === "installmentValue"
                        ? formData.firstInstallmentDate
                          ? new Date(
                              formData.firstInstallmentDate + "T12:00:00",
                            ).toLocaleDateString("pt-BR")
                          : "Data não definida"
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
