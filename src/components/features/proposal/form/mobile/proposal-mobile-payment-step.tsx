"use client";

import * as React from "react";
import {
  ArrowRightLeft,
  Banknote,
  CalendarClock,
  CreditCard,
  Landmark,
  Percent,
  Wallet,
} from "lucide-react";
import { Proposal, ProposalProduct } from "@/services/proposal-service";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { WalletSelect } from "@/components/features/wallet-select";
import {
  MobileFieldShell,
  MobileMetric,
  MobilePanel,
  MobileToggleCard,
  formatCurrency,
  getProposalDownPaymentValue,
} from "./shared";

interface ProposalMobilePaymentStepProps {
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
  errors?: Record<string, string>;
}

export function ProposalMobilePaymentStep({
  formData,
  selectedProducts,
  calculateTotal,
  onFormChange,
  onPaymentToggle,
  onExtraExpenseChange,
  errors = {},
}: ProposalMobilePaymentStepProps) {
  const [discountType, setDiscountType] = React.useState<"percent" | "fixed">(
    formData.closedValue && formData.closedValue > 0 ? "fixed" : "percent",
  );

  React.useEffect(() => {
    if (formData.closedValue && formData.closedValue > 0) {
      setDiscountType("fixed");
      return;
    }

    setDiscountType("percent");
  }, [formData.closedValue]);

  const emitSyntheticChange = React.useCallback(
    (name: string, value: string | number | null) => {
      onFormChange({
        target: {
          name,
          value,
        },
      } as React.ChangeEvent<HTMLInputElement>);
    },
    [onFormChange],
  );

  const productsValue = selectedProducts.reduce((sum, product) => {
    return sum + product.total;
  }, 0);

  const totalProfit = selectedProducts.reduce((sum, product) => {
    if ((product.itemType || "product") === "service") {
      return sum;
    }

    return sum + product.unitPrice * product.quantity * ((product.markup || 0) / 100);
  }, 0);

  const totalValue = calculateTotal();
  const extraExpense = formData.extraExpense || 0;
  const downPaymentValue = getProposalDownPaymentValue(formData, totalValue);
  const remainingBalance = Math.max(0, totalValue - downPaymentValue);
  const rawTotal = productsValue + extraExpense;
  const discountValue =
    discountType === "fixed"
      ? Math.max(0, rawTotal - (formData.closedValue || 0))
      : (rawTotal * (formData.discount || 0)) / 100;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <MobileMetric
          label="Base"
          value={formatCurrency(productsValue)}
          hint={`${selectedProducts.length} item(ns) ativos na proposta`}
          accent="sky"
        />
        <MobileMetric
          label="Total final"
          value={formatCurrency(totalValue)}
          hint={extraExpense > 0 ? `inclui ${formatCurrency(extraExpense)} extras` : "sem custo adicional"}
          accent="emerald"
        />
      </div>

      <MobilePanel
        eyebrow="Ajuste comercial"
        title="Desconto e custos adicionais"
        description="Ajuste o valor final antes de definir o recebimento."
        icon={Percent}
        tone="accent"
      >
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setDiscountType("percent");
              emitSyntheticChange("closedValue", null);
              emitSyntheticChange("discount", formData.discount || 0);
            }}
            className={`min-h-12 rounded-2xl border px-3 py-2 text-sm font-semibold transition-all ${
              discountType === "percent"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/60 bg-background/70"
            }`}
          >
            Desconto %
          </button>
          <button
            type="button"
            onClick={() => {
              setDiscountType("fixed");
              emitSyntheticChange("discount", 0);
            }}
            className={`min-h-12 rounded-2xl border px-3 py-2 text-sm font-semibold transition-all ${
              discountType === "fixed"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/60 bg-background/70"
            }`}
          >
            Valor combinado
          </button>
        </div>

        <div className="grid gap-4">
          {discountType === "percent" ? (
            <MobileFieldShell label="Desconto percentual">
              <Input
                id="discount"
                name="discount"
                type="number"
                min={0}
                max={100}
                value={formData.discount === 0 ? "" : formData.discount || ""}
                onChange={(event) => {
                  const value = event.target.value;
                  emitSyntheticChange("discount", value === "" ? 0 : Number(value));
                }}
                suffix={<span className="text-sm">%</span>}
                icon={<Percent className="h-4 w-4" />}
              />
            </MobileFieldShell>
          ) : (
            <MobileFieldShell label="Valor final negociado">
              <CurrencyInput
                id="closedValue"
                name="closedValue"
                value={formData.closedValue || 0}
                onChange={onFormChange}
              />
            </MobileFieldShell>
          )}

          <MobileFieldShell label="Custos adicionais">
            <CurrencyInput
              id="extraExpense"
              name="extraExpense"
              value={formData.extraExpense || 0}
              onChange={(event) => {
                const value = Number(event.target.value || 0);
                onExtraExpenseChange(Math.max(0, value));
              }}
            />
          </MobileFieldShell>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MobileMetric
            label="Desconto aplicado"
            value={formatCurrency(discountValue)}
            accent="amber"
          />
          <MobileMetric
            label="Lucro projetado"
            value={formatCurrency(totalProfit)}
            accent="emerald"
          />
        </div>
      </MobilePanel>

      <MobilePanel
        eyebrow="Fluxo de recebimento"
        title="Entrada"
        description="Use apenas quando houver sinal ou valor inicial."
        icon={Banknote}
      >
        <MobileToggleCard
          title="Receber entrada"
          description="Separar um valor inicial do saldo."
          checked={!!formData.downPaymentEnabled}
          onCheckedChange={(checked) =>
            onPaymentToggle("downPaymentEnabled", checked)
          }
          icon={Banknote}
        />

        {formData.downPaymentEnabled ? (
          <div className="space-y-4">
            <MobileFieldShell label="Tipo da entrada">
              <Select
                id="downPaymentType"
                name="downPaymentType"
                value={formData.downPaymentType || "value"}
                onChange={onFormChange}
                options={[
                  { value: "value", label: "Valor fixo" },
                  { value: "percentage", label: "Porcentagem" },
                ]}
              />
            </MobileFieldShell>

            {(formData.downPaymentType || "value") === "percentage" ? (
              <MobileFieldShell
                label="Percentual da entrada"
                error={errors.downPaymentPercentage}
              >
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
                  className={errors.downPaymentPercentage ? "border-destructive" : ""}
                />
              </MobileFieldShell>
            ) : (
              <MobileFieldShell
                label="Valor da entrada"
                error={errors.downPaymentValue}
              >
                <CurrencyInput
                  id="downPaymentValue"
                  name="downPaymentValue"
                  value={formData.downPaymentValue || 0}
                  onChange={onFormChange}
                  className={errors.downPaymentValue ? "border-destructive" : ""}
                />
              </MobileFieldShell>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <MobileFieldShell
                label="Data da entrada"
                error={errors.downPaymentDueDate}
              >
                <DatePicker
                  id="downPaymentDueDate"
                  name="downPaymentDueDate"
                  value={formData.downPaymentDueDate || ""}
                  onChange={onFormChange}
                  className={errors.downPaymentDueDate ? "border-destructive" : ""}
                />
              </MobileFieldShell>

              <div className="space-y-2">
                <WalletSelect
                  label="Carteira da entrada"
                  name="downPaymentWallet"
                  value={formData.downPaymentWallet || ""}
                  onChange={onFormChange}
                  preSelectDefault
                />
              </div>
            </div>

            <div className="rounded-2xl border border-sky-500/20 bg-sky-500/8 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Landmark className="h-4 w-4 text-sky-700 dark:text-sky-300" />
                Previsao da entrada
              </div>
              <p className="mt-2 text-sm leading-5 text-muted-foreground">
                Entrada prevista: <strong>{formatCurrency(downPaymentValue)}</strong>
              </p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                Saldo restante apos entrada: <strong>{formatCurrency(remainingBalance)}</strong>
              </p>
            </div>
          </div>
        ) : null}
      </MobilePanel>

      <MobilePanel
        eyebrow="Parcelamento"
        title="Divisao do saldo"
        description="Defina parcelas, carteira e primeiro vencimento."
        icon={CreditCard}
        tone="success"
      >
        <MobileToggleCard
          title="Parcelar proposta"
          description="Dividir o saldo em parcelas."
          checked={!!formData.installmentsEnabled}
          onCheckedChange={(checked) =>
            onPaymentToggle("installmentsEnabled", checked)
          }
          icon={ArrowRightLeft}
        />

        {formData.installmentsEnabled ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <MobileFieldShell label="Numero de parcelas">
                <Input
                  id="installmentsCount"
                  name="installmentsCount"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Ex: 12"
                  value={formData.installmentsCount || ""}
                  onChange={onFormChange}
                  icon={<CreditCard className="h-4 w-4" />}
                />
              </MobileFieldShell>

              <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Valor por parcela
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {formatCurrency(formData.installmentValue || 0)}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <MobileFieldShell
                label="Primeiro vencimento"
                error={errors.firstInstallmentDate}
              >
                <DatePicker
                  id="firstInstallmentDate"
                  name="firstInstallmentDate"
                  value={formData.firstInstallmentDate || ""}
                  onChange={onFormChange}
                  className={errors.firstInstallmentDate ? "border-destructive" : ""}
                />
              </MobileFieldShell>

              <div className="space-y-2">
                <WalletSelect
                  label="Carteira das parcelas"
                  name="installmentsWallet"
                  value={formData.installmentsWallet || ""}
                  onChange={onFormChange}
                  preSelectDefault
                />
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <CalendarClock className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                Leitura rapida
              </div>
              <p className="mt-2 text-sm leading-5 text-muted-foreground">
                {formData.installmentsCount || 1}x de{" "}
                <strong>{formatCurrency(formData.installmentValue || 0)}</strong>
              </p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                Primeiro vencimento:{" "}
                <strong>
                  {formData.firstInstallmentDate
                    ? new Date(
                        `${formData.firstInstallmentDate}T12:00:00`,
                      ).toLocaleDateString("pt-BR")
                    : "nao definido"}
                </strong>
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              Pagamento sem parcelamento
            </div>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">
              Saldo previsto em pagamento unico: <strong>{formatCurrency(remainingBalance)}</strong>
            </p>
          </div>
        )}
      </MobilePanel>
    </div>
  );
}
