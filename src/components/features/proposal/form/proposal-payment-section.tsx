"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Proposal, ProposalProduct } from "@/services/proposal-service";
import { CreditCard, Wallet, Calendar, Banknote, BadgePercent } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CurrencyInput } from "@/components/ui/currency-input";
import { WalletSelect } from "@/components/features/wallet-select";
import { useTenant } from "@/providers/tenant-provider";
import { KanbanService } from "@/services/kanban-service";

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
  const { tenant } = useTenant();
  const [isApproved, setIsApproved] = React.useState<boolean>(
    formData.status === "approved" || formData.status === "default_2"
  );

  React.useEffect(() => {
    if (!tenant?.id) return;
    let cancelled = false;
    KanbanService.getStatuses(tenant.id).then((columns) => {
      if (cancelled) return;
      const isAppr = columns.some(
        (c) =>
          (c.mappedStatus === "approved" || c.id === "default_2" || c.id === "approved") &&
          c.id === formData.status
      );
      setIsApproved(
        formData.status === "approved" || formData.status === "default_2" || isAppr
      );
    });
    return () => {
      cancelled = true;
    };
  }, [tenant?.id, formData.status]);

  const [discountType, setDiscountType] = React.useState<"percent" | "fixed">(
    formData.closedValue && formData.closedValue > 0 ? "fixed" : "percent"
  );
  
  const prevIsApproved = React.useRef(isApproved);

  React.useEffect(() => {
    if (formData.closedValue && formData.closedValue > 0) {
      setDiscountType("fixed");
    }
  }, [formData.closedValue]);

  React.useEffect(() => {
    if (prevIsApproved.current === true && isApproved === false && discountType === "fixed") {
      setDiscountType("percent");
    }
    prevIsApproved.current = isApproved;
  }, [isApproved, discountType]);

  const handleTabChange = (v: string) => {
    const newType = v as "percent" | "fixed";
    setDiscountType(newType);
    if (newType === "percent") {
      onFormChange({ target: { name: "closedValue", value: null } } as unknown as React.ChangeEvent<HTMLInputElement>);
      onFormChange({ target: { name: "discount", value: 0 } } as unknown as React.ChangeEvent<HTMLInputElement>);
    } else {
      onFormChange({ target: { name: "discount", value: 0 } } as unknown as React.ChangeEvent<HTMLInputElement>);
      onFormChange({ target: { name: "closedValue", value: null } } as unknown as React.ChangeEvent<HTMLInputElement>);
    }
  };

  const productsValue = selectedProducts.reduce((sum, p) => sum + p.total, 0);
  const totalProfit = selectedProducts.reduce((sum, p) => {
    if ((p.itemType || "product") === "service") {
      return sum;
    }
    const basePrice = p.unitPrice * p.quantity;
    const profit = basePrice * ((p.markup || 0) / 100);
    return sum + profit;
  }, 0);
  const extraExpense = formData.extraExpense || 0;
  const finalTotal = calculateTotal();
  const downPaymentType = formData.downPaymentType || "value";
  const downPaymentPercentage = formData.downPaymentPercentage || 0;
  const effectiveDownPaymentValue =
    downPaymentType === "percentage"
      ? (finalTotal * downPaymentPercentage) / 100
      : formData.downPaymentValue || 0;

  const content = (
    <div className="space-y-6">
      {/* Ajustes de Valor */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Discount Section */}
        <div className="p-5 rounded-xl bg-purple-500/10 border-2 border-purple-500/20 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <BadgePercent className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <Label className="text-base font-semibold text-purple-900 dark:text-purple-300">Desconto Comercial</Label>
            </div>
            <p className="text-sm text-purple-700/80 dark:text-purple-300/80 mb-4">
              Aplique um percentual de desconto <strong>ou</strong> defina um valor combinado com o cliente — o valor final que substituirá o total da proposta.
            </p>
          </div>
          
          <Tabs value={discountType} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-3 bg-purple-500/10">
              <TabsTrigger value="percent" className="data-[state=active]:bg-purple-500 data-[state=active]:text-white data-[state=active]:shadow-md">Desconto (%)</TabsTrigger>
              <TabsTrigger value="fixed" className="data-[state=active]:bg-purple-500 data-[state=active]:text-white data-[state=active]:shadow-md">Valor Combinado</TabsTrigger>
            </TabsList>
            
            <div className="mt-2 h-10">
              {discountType === "percent" ? (
                <div className="relative">
                  <Input
                    id="discount"
                    name="discount"
                    type="number"
                    min={0}
                    max={100}
                    value={formData.discount === 0 ? "" : (formData.discount || 0)}
                    onChange={(e) => {
                      const val = e.target.value;
                      const numVal = val === "" ? 0 : Number(val);
                      onFormChange({ target: { name: "discount", value: numVal } } as unknown as React.ChangeEvent<HTMLInputElement>);
                    }}
                    className="w-full pr-8 bg-background/80 border-purple-500/30 focus-visible:ring-purple-500 focus-visible:border-purple-500"
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">%</span>
                </div>
              ) : (
                <CurrencyInput
                  id="closedValue"
                  name="closedValue"
                  value={formData.closedValue || 0}
                  onChange={onFormChange}
                  placeholder="Ex: 5.000,00"
                  className="w-full bg-background/80 border-purple-500/30 focus-visible:ring-purple-500 focus-visible:border-purple-500"
                />
              )}
            </div>
          </Tabs>
        </div>

        {/* Extra Expense Section */}
        <div className="p-5 rounded-xl bg-orange-500/10 border-2 border-orange-500/20 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Banknote className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              <Label htmlFor="extraExpense" className="text-base font-semibold text-orange-900 dark:text-orange-300">
                Custos Adicionais
              </Label>
            </div>
            <p className="text-sm text-orange-700/80 dark:text-orange-300/80 mb-4">
              Valores extras (frete, deslocamento) que serão adicionados ao valor final da proposta.
            </p>
          </div>
          <CurrencyInput
            id="extraExpense"
            name="extraExpense"
            value={formData.extraExpense || 0}
            onChange={(e) => {
              const value = parseFloat(e.target.value) || 0;
              onExtraExpenseChange(Math.max(0, value));
            }}
            placeholder="0,00"
            className="w-full bg-background/80 border-orange-500/30 focus-visible:ring-orange-500 focus-visible:border-orange-500 mt-auto shadow-sm"
          />
        </div>
      </div>

      {/* Financial Summary Card - Always visible */}
      {selectedProducts.length > 0 && (
        <div className="p-4 rounded-xl bg-linear-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border-2 border-blue-200 dark:border-blue-800">
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
            {/* Discount applied line */}
            {(() => {
              const rawTotal = selectedProducts.reduce((sum, p) => (Number(p.quantity || 0) > 0 ? sum + p.total : sum), 0) + extraExpense;
              const hasClosedValue = formData.closedValue && formData.closedValue > 0;
              const percentDiscount = formData.discount && formData.discount > 0;
              if (hasClosedValue && rawTotal > formData.closedValue!) {
                const diff = rawTotal - formData.closedValue!;
                return (
                  <div className="flex justify-between items-center">
                    <span className="text-purple-600 dark:text-purple-400">- Desconto Comercial (Fixo):</span>
                    <span className="font-medium text-purple-600 dark:text-purple-400">
                      - R$ {diff.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                );
              }
              if (percentDiscount) {
                const discountAmt = (rawTotal * (formData.discount || 0)) / 100;
                return (
                  <div className="flex justify-between items-center">
                    <span className="text-purple-600 dark:text-purple-400">- Desconto ({formData.discount}%):</span>
                    <span className="font-medium text-purple-600 dark:text-purple-400">
                      - R$ {discountAmt.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                );
              }
              return null;
            })()}
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

      {/* Down Payment Section - Independent from installments */}
      <div className="space-y-4">
        <label
          htmlFor="downPaymentEnabled"
          className="flex items-center gap-3 p-4 rounded-xl border-2 border-transparent hover:border-blue-500/20 hover:bg-blue-500/5 transition-all cursor-pointer group bg-muted/30"
        >
          <div
            className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
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
              <Banknote className="w-5 h-5 text-blue-500" />
              <span className="font-semibold text-base">Entrada</span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Valor pago à vista, mesmo sem parcelamento
            </p>
          </div>
        </label>

        {formData.downPaymentEnabled && (
          <div className="ml-4 pl-4 border-l-2 border-blue-500/20 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div className="field-gap">
                <div className="min-h-5">
                  <Label htmlFor="downPaymentType">Tipo da Entrada</Label>
                </div>
                <Select
                  id="downPaymentType"
                  name="downPaymentType"
                  value={downPaymentType}
                  onChange={onFormChange}
                >
                  <option value="value">Valor</option>
                  <option value="percentage">Porcentagem</option>
                </Select>
              </div>
              <WalletSelect
                label="Carteira para entrada (interno)"
                name="downPaymentWallet"
                value={formData.downPaymentWallet || ""}
                onChange={onFormChange}
                preSelectDefault
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <div className="field-gap">
                <div className="min-h-5">
                  <Label
                    htmlFor={
                      downPaymentType === "percentage"
                        ? "downPaymentPercentage"
                        : "downPaymentValue"
                    }
                    className={
                      downPaymentType === "percentage"
                        ? errors.downPaymentPercentage
                          ? "text-destructive"
                          : ""
                        : errors.downPaymentValue
                          ? "text-destructive"
                          : ""
                    }
                  >
                    {downPaymentType === "percentage"
                      ? "Porcentagem da Entrada"
                      : "Valor da Entrada"}
                  </Label>
                </div>
                {downPaymentType === "percentage" ? (
                  <div className="space-y-4">
                    <Input
                      id="downPaymentPercentage"
                      name="downPaymentPercentage"
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={formData.downPaymentPercentage ?? ""}
                      onChange={onFormChange}
                      suffix={<span className="text-sm">%</span>}
                      className={`w-full ${errors.downPaymentPercentage ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                    {errors.downPaymentPercentage && (
                      <p className="text-xs text-destructive mt-1">
                        {errors.downPaymentPercentage}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Valor calculado: R${" "}
                      {effectiveDownPaymentValue.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <CurrencyInput
                      id="downPaymentValue"
                      name="downPaymentValue"
                      value={formData.downPaymentValue || 0}
                      onChange={onFormChange}
                      className={errors.downPaymentValue ? "border-destructive focus-visible:ring-destructive" : ""}
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
                    htmlFor="downPaymentDueDate"
                    className={errors.downPaymentDueDate ? "text-destructive" : ""}
                  >
                    Data da Entrada
                  </Label>
                </div>
                <DatePicker
                  id="downPaymentDueDate"
                  name="downPaymentDueDate"
                  value={formData.downPaymentDueDate || ""}
                  onChange={onFormChange}
                  className={errors.downPaymentDueDate ? "border-destructive focus-visible:ring-destructive" : ""}
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
              <div className="field-gap">
                <div className="min-h-5">
                  <Label htmlFor="installmentsCount">Número de Parcelas</Label>
                </div>
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
              <div className="field-gap">
                <div className="min-h-5">
                  <Label>Valor por Parcela</Label>
                </div>
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
                  onChange={onFormChange}
                  className={errors.firstInstallmentDate ? "border-destructive focus-visible:ring-destructive" : ""}
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
                  effectiveDownPaymentValue > 0 && (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-blue-500">• Entrada:</span>
                      <span className="font-semibold text-blue-500">
                        R${" "}
                        {effectiveDownPaymentValue.toLocaleString(
                          "pt-BR",
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          },
                        )}
                        {downPaymentType === "percentage"
                          ? ` (${downPaymentPercentage.toFixed(2)}%)`
                          : ""}
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
              {formData.downPaymentEnabled && effectiveDownPaymentValue > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  Entrada: R${" "}
                  {effectiveDownPaymentValue.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                  {downPaymentType === "percentage"
                    ? ` (${downPaymentPercentage.toFixed(2)}%)`
                    : ""}
                  {" • "}
                  Saldo: R${" "}
                  {Math.max(0, calculateTotal() - effectiveDownPaymentValue).toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              )}
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


