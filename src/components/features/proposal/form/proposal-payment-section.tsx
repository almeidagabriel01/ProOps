"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Proposal, ProposalProduct } from "@/services/proposal-service";
import { CreditCard, Wallet, Calendar, Banknote } from "lucide-react";
import { CurrencyInput } from "@/components/ui/currency-input";
import { WalletSelect } from "@/components/features/wallet-select";

interface ProposalPaymentSectionProps {
  formData: Partial<Proposal>;
  selectedProducts: ProposalProduct[];
  calculateTotal: () => number;
  onFormChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => void;
  onPaymentToggle: (field: string, value: boolean) => void;
  onExtraExpenseChange: (value: number) => void;
  noContainer?: boolean;
  errors?: Record<string, string>;
}

export function ProposalPaymentSection({
  formData,
  selectedProducts,
  calculateTotal,
  onFormChange,
  onPaymentToggle,
  onExtraExpenseChange,
  noContainer = false,
  errors = {},
}: ProposalPaymentSectionProps) {
  // Calculate components
  const productsValue = selectedProducts.reduce((sum, p) => sum + p.total, 0);
  const totalProfit = selectedProducts.reduce((sum, p) => {
    const basePrice = p.unitPrice * p.quantity;
    const profit = basePrice * ((p.markup || 0) / 100);
    return sum + profit;
  }, 0);
  const extraExpense = formData.extraExpense || 0;
  const finalTotal = calculateTotal();

  const content = (
    <div className="space-y-6">
      {/* Extra Expense Section */}
      <div className="p-4 rounded-xl bg-orange-500/10 border-2 border-orange-500/20">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-orange-600" />
            <Label htmlFor="extraExpense" className="text-base font-semibold">
              Valor Extra (Custos Adicionais)
            </Label>
          </div>
          <p className="text-sm text-muted-foreground">
            Custos adicionais como frete, gasolina, etc. Serão somados ao valor
            total
          </p>
          <CurrencyInput
            id="extraExpense"
            name="extraExpense"
            value={formData.extraExpense || 0}
            onChange={(e) => {
              const value = parseFloat(e.target.value) || 0;
              onExtraExpenseChange(Math.max(0, value));
            }}
            placeholder="0,00"
          />
        </div>
      </div>

      {/* Financial Summary Card - Always visible */}
      {selectedProducts.length > 0 && (
        <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border-2 border-blue-200 dark:border-blue-800">
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Resumo Financeiro
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Valor dos Produtos:</span>
              <span className="font-medium">
                R${" "}
                {productsValue.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-green-600 dark:text-green-400">
                Lucro Total:
              </span>
              <span className="font-semibold text-green-600 dark:text-green-400">
                R${" "}
                {totalProfit.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            {extraExpense > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-orange-600">+ Valor Extra:</span>
                <span className="font-medium text-orange-600">
                  R${" "}
                  {extraExpense.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            )}
            <div className="h-px bg-border my-2" />
            <div className="flex justify-between items-center text-base">
              <span className="font-semibold">Total da Proposta:</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">
                R${" "}
                {finalTotal.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Installments Section - Primary toggle */}
      <div className="space-y-4">
        <label
          htmlFor="installmentsEnabled"
          className="flex items-center gap-3 p-4 rounded-xl border-2 border-transparent hover:border-primary/20 hover:bg-primary/5 transition-all cursor-pointer group bg-muted/30"
        >
          <div
            className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
              formData.installmentsEnabled
                ? "bg-primary border-primary"
                : "border-muted-foreground/40 group-hover:border-primary/60"
            }`}
          >
            {formData.installmentsEnabled && (
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
            id="installmentsEnabled"
            checked={formData.installmentsEnabled || false}
            onChange={(e) =>
              onPaymentToggle("installmentsEnabled", e.target.checked)
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

        {formData.installmentsEnabled && (
          <div className="ml-4 pl-4 border-l-2 border-primary/20 space-y-5">
            {/* Installment Configuration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="installmentsCount">Número de Parcelas</Label>
                <Input
                  id="installmentsCount"
                  name="installmentsCount"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Ex: 12"
                  value={formData.installmentsCount || ""}
                  onChange={onFormChange}
                />
              </div>
              <div className="space-y-2">
                <Label>Valor por Parcela</Label>
                <div className="h-12 flex items-center px-4 rounded-xl border-2 border-border/60 bg-muted/50 text-sm font-semibold">
                  R${" "}
                  {(formData.installmentValue || 0).toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
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
                  onChange={onFormChange}
                  preSelectDefault
                />
              </div>
            </div>

            {/* First Installment Date */}
            <div className="flex items-center gap-2">
              <Calendar
                className={`w-4 h-4 ${errors.firstInstallmentDate ? "text-destructive" : "text-muted-foreground"}`}
              />
              <div className="flex-1">
                <Label
                  htmlFor="firstInstallmentDate"
                  className={
                    errors.firstInstallmentDate ? "text-destructive" : ""
                  }
                >
                  Vencimento da 1ª Parcela
                </Label>
                <DatePicker
                  id="firstInstallmentDate"
                  name="firstInstallmentDate"
                  value={formData.firstInstallmentDate || ""}
                  onChange={onFormChange}
                  className={`mt-1 ${errors.firstInstallmentDate ? "border-destructive focus-visible:ring-destructive" : ""}`}
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

            {/* Down Payment Section - Nested inside Parcelamento */}
            <div className="pt-4 border-t border-dashed border-border/50">
              <label
                htmlFor="downPaymentEnabled"
                className="flex items-center gap-3 p-3 rounded-lg border-2 border-transparent hover:border-blue-500/20 hover:bg-blue-500/5 transition-all cursor-pointer group"
              >
                <div
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                    formData.downPaymentEnabled
                      ? "bg-blue-500 border-blue-500"
                      : "border-muted-foreground/40 group-hover:border-blue-500/60"
                  }`}
                >
                  {formData.downPaymentEnabled && (
                    <svg
                      className="w-3 h-3 text-white"
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
                  id="downPaymentEnabled"
                  checked={formData.downPaymentEnabled || false}
                  onChange={(e) =>
                    onPaymentToggle("downPaymentEnabled", e.target.checked)
                  }
                  className="sr-only"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-blue-500" />
                    <span className="font-medium">Incluir Entrada</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Valor pago à vista antes das parcelas
                  </p>
                </div>
              </label>

              {formData.downPaymentEnabled && (
                <div className="ml-8 mt-3 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div className="space-y-2">
                      <Label htmlFor="downPaymentValue">Valor da Entrada</Label>
                      <CurrencyInput
                        id="downPaymentValue"
                        name="downPaymentValue"
                        value={formData.downPaymentValue || 0}
                        onChange={onFormChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <WalletSelect
                        label="Carteira para entrada (interno)"
                        name="downPaymentWallet"
                        value={formData.downPaymentWallet || ""}
                        onChange={onFormChange}
                        preSelectDefault
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar
                      className={`w-4 h-4 ${errors.downPaymentDueDate ? "text-destructive" : "text-muted-foreground"}`}
                    />
                    <div className="flex-1">
                      <Label
                        htmlFor="downPaymentDueDate"
                        className={
                          errors.downPaymentDueDate ? "text-destructive" : ""
                        }
                      >
                        Data da Entrada
                      </Label>
                      <DatePicker
                        id="downPaymentDueDate"
                        name="downPaymentDueDate"
                        value={formData.downPaymentDueDate || ""}
                        onChange={onFormChange}
                        className={`mt-1 ${errors.downPaymentDueDate ? "border-destructive focus-visible:ring-destructive" : ""}`}
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

            {/* Summary */}
            <div className="p-4 rounded-xl bg-linear-to-r from-primary/10 to-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-primary" />
                </div>
                <span className="font-semibold">Resumo do Pagamento</span>
              </div>
              <div className="text-sm space-y-2">
                <div className="flex justify-between items-center py-1 border-b border-border/30">
                  <span className="text-muted-foreground">
                    Total da Proposta:
                  </span>
                  <span className="font-semibold">
                    R${" "}
                    {calculateTotal().toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                {formData.downPaymentEnabled &&
                  formData.downPaymentValue &&
                  formData.downPaymentValue > 0 && (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-blue-500">• Entrada:</span>
                      <span className="font-semibold text-blue-500">
                        R${" "}
                        {(formData.downPaymentValue || 0).toLocaleString(
                          "pt-BR",
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          },
                        )}
                      </span>
                    </div>
                  )}
                <div className="flex justify-between items-center py-1">
                  <span className="text-primary">• Parcelas:</span>
                  <span className="font-semibold text-primary">
                    {formData.installmentsCount || 1}x de R${" "}
                    {(formData.installmentValue || 0).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* No installments - Show single payment info */}
      {!formData.installmentsEnabled && (
        <div className="p-4 rounded-xl bg-muted/30 border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Pagamento à Vista</p>
              <p className="text-sm text-muted-foreground">
                Total:{" "}
                <span className="font-semibold text-primary">
                  R${" "}
                  {calculateTotal().toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (noContainer) {
    return content;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Condições de Pagamento
        </CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
