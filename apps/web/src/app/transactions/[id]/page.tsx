"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Wallet, AlertCircle, Info } from "lucide-react";
import {
  useEditTransaction,
  EditTransactionFormData,
} from "../_hooks/useEditTransaction";
import { FormContainer, FormHeader } from "@/components/ui/form-components";
import { StepWizard, StepNavigation } from "@/components/ui/step-wizard";
import { FormStepCard } from "@/components/ui/form-step-card";
import {
  TypeSelectorStep,
  DetailsStep,
  PaymentStep,
  ReviewStep,
} from "../_components/form-steps";

import { TransactionFormData } from "../_hooks/useTransactionForm";
import { TrendingUp, FileText, CreditCard, CheckCircle } from "lucide-react";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { UpgradeRequired } from "@/components/ui/upgrade-required";
import { EntityLoadingState } from "@/components/shared/entity-loading-state";
import { useTenant } from "@/providers/tenant-provider";

const transactionSteps = [
  {
    id: "type",
    title: "Tipo",
    description: "Receita ou despesa",
    icon: TrendingUp,
  },
  {
    id: "details",
    title: "Detalhes",
    description: "Informações",
    icon: FileText,
  },
  {
    id: "payment",
    title: "Pagamento",
    description: "Forma e parcelas",
    icon: CreditCard,
  },
  {
    id: "review",
    title: "Revisar",
    description: "Confirmar dados",
    icon: CheckCircle,
  },
];

export default function EditTransactionPage() {
  const router = useRouter();
  const { isReadOnly } = useTenant();
  const { hasFinancial, isLoading: planLoading } = usePlanLimits();
  const {
    formData,
    setFormData,
    handleChange,
    handleClientChange,
    handleSubmit,
    transaction,
    relatedInstallments,

    isLoading,
    isSaving,
    hasChanges,
    canEdit,
    isProposalTransaction,
    groupTotalValue,
    switchPaymentMode,
    recurringEditScope,
    setRecurringEditScope,
    fromGrouped,
  } = useEditTransaction();

  // Adapt formData type for shared components
  // Moved to top and handled null transaction
  const adaptedFormData: TransactionFormData = React.useMemo(
    () => ({
      ...formData,
      clientId: formData.clientId || "",
      isInstallment: formData.isInstallment,
      isRecurring: formData.isRecurring,
      installmentCount: formData.installmentCount,
      // Pass through new fields instead of resetting them
      paymentMode: formData.paymentMode,
      installmentValue: formData.installmentValue,
      firstInstallmentDate: formData.firstInstallmentDate,
      installmentsWallet: formData.installmentsWallet,
      downPaymentEnabled: formData.downPaymentEnabled,
      downPaymentType: formData.downPaymentType,
      downPaymentPercentage: formData.downPaymentPercentage,
      downPaymentValue: formData.downPaymentValue,
      downPaymentWallet: formData.downPaymentWallet,
      downPaymentDueDate: formData.downPaymentDueDate,
      installmentInterval: formData.installmentInterval,
    }),
    [formData],
  );

  const [paymentErrors, setPaymentErrors] = React.useState<
    Partial<Record<keyof TransactionFormData, string>>
  >({});

  const handlePaymentFieldChange = React.useCallback(
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      handleChange(e);
      const { name } = e.target;
      if (
        name === "downPaymentPercentage" ||
        name === "downPaymentValue" ||
        name === "downPaymentDueDate" ||
        name === "firstInstallmentDate" ||
        name === "dueDate"
      ) {
        setPaymentErrors((prev) => {
          if (!prev[name as keyof TransactionFormData]) return prev;
          return {
            ...prev,
            [name]: undefined,
          };
        });
      }
    },
    [handleChange],
  );

  const validatePaymentStep = React.useCallback((): boolean => {
    const errors: Partial<Record<keyof TransactionFormData, string>> = {};

    if (adaptedFormData.downPaymentEnabled) {
      if (adaptedFormData.downPaymentType === "percentage") {
        const percentage = parseFloat(
          adaptedFormData.downPaymentPercentage || "0",
        );
        if (!adaptedFormData.downPaymentPercentage || percentage <= 0) {
          errors.downPaymentPercentage =
            "Percentual da entrada deve ser maior que 0";
        }
      } else if (
        !adaptedFormData.downPaymentValue ||
        parseFloat(adaptedFormData.downPaymentValue) <= 0
      ) {
        errors.downPaymentValue = "Valor da entrada deve ser maior que 0";
      }
    }

    if (
      adaptedFormData.downPaymentEnabled &&
      !adaptedFormData.downPaymentDueDate
    ) {
      errors.downPaymentDueDate = "Data da entrada é obrigatória";
    }

    if (adaptedFormData.isInstallment) {
      if (adaptedFormData.paymentMode === "installmentValue") {
        if (!adaptedFormData.firstInstallmentDate) {
          errors.firstInstallmentDate =
            "Data de vencimento da primeira parcela é obrigatória";
        }
      } else if (!adaptedFormData.dueDate) {
        errors.dueDate = "Vencimento da primeira parcela é obrigatório";
      }
    }

    setPaymentErrors(errors);
    return Object.keys(errors).length === 0;
  }, [adaptedFormData]);

  const stepValidators = React.useMemo(
    () => ({
      2: validatePaymentStep,
    }),
    [validatePaymentStep],
  );

  // Calculate total amount (sum of all installments) for display
  const totalValueOverride = React.useMemo(() => {
    if (
      !(transaction?.isInstallment || transaction?.isRecurring) ||
      relatedInstallments.length === 0
    )
      return undefined;

    // If it's a proposal group, use the explicit group total value
    if (isProposalTransaction && groupTotalValue) {
      return groupTotalValue;
    }

    // For standard installment/recurring groups (or new ones), formData.amount IS now the total
    return parseFloat(formData.amount || "0");
  }, [
    transaction,
    isProposalTransaction,
    groupTotalValue,
    formData.amount,
    relatedInstallments.length,
  ]);

  // Resolve current installment number (with fallbacks if undefined)
  const resolvedInstallmentNumber = React.useMemo(() => {
    if (transaction?.installmentNumber) {
      return transaction.installmentNumber;
    }
    // Fallback 1: Parse from description
    const desc = transaction?.description || "";
    const match = desc.match(/\((\d+)\/\d+\)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num)) return num;
    }
    // Fallback 2: Check index in relatedInstallments
    if (transaction && relatedInstallments.length > 0) {
      const regularInstallments = relatedInstallments.filter(t => !t.isDownPayment);
      const index = regularInstallments.findIndex(t => t.id === transaction.id);
      if (index !== -1) {
        return index + 1;
      }
    }
    return undefined;
  }, [transaction, relatedInstallments]);

  // Show loading first - before checking plan access to avoid flash
  if (isLoading || planLoading) {
    return <EntityLoadingState message="Carregando transação..." />;
  }

  // Check plan access after loading is complete
  if (!hasFinancial) {
    return (
      <UpgradeRequired
        feature="Editar Lançamento"
        description="O módulo Financeiro permite gerenciar suas receitas, despesas e fluxo de caixa. Faça upgrade para o plano Profissional ou Enterprise para acessar."
      />
    );
  }

  if (!transaction) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-1">
              Lançamento não encontrado
            </h2>
            <p className="text-muted-foreground text-sm">
              O lançamento solicitado não existe ou foi removido.
            </p>
          </div>
          <button
            onClick={() => router.push("/transactions")}
            className="h-11 px-6 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            Voltar para Financeiro
          </button>
        </div>
      </div>
    );
  }

  const handleFormSubmit = async () => {
    if (!validatePaymentStep()) {
      return;
    }

    const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
    await handleSubmit(fakeEvent);
  };

  // Read-only view without wizard
  if (!canEdit) {
    return (
      <FormContainer>
        <FormHeader
          title="Visualizar Lançamento"
          subtitle="Detalhes do lançamento financeiro"
          icon={Wallet}
          onBack={() => router.push("/transactions")}
        />

        <ReviewStep
          formData={adaptedFormData}
          onChange={() => {}}
          onClientChange={() => {}}
          totalOverride={totalValueOverride}
          installmentNumber={resolvedInstallmentNumber}
          recurringEditScope={recurringEditScope}
        />

        <div className="flex justify-end pt-6">
          <button
            onClick={() => router.push("/transactions")}
            className="h-12 px-6 rounded-xl bg-card border border-border/50 text-sm font-medium hover:bg-muted transition-colors"
          >
            Voltar
          </button>
        </div>
      </FormContainer>
    );
  }

  return (
    <FormContainer>
      <FormHeader
        title="Editar Lançamento"
        subtitle="Atualize as informações do lançamento"
        icon={Wallet}
        onBack={() => router.push("/transactions")}
      />

      {(transaction?.isRecurring || transaction?.isInstallment || !!transaction?.installmentGroupId) && !fromGrouped && (
        <div className="mb-6 rounded-xl border border-border/50 bg-card p-4">
          <p className="mb-3 text-sm font-medium text-foreground">
            Aplicar alterações:
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/50 p-3 text-sm transition-colors hover:bg-muted/50">
              <input
                type="radio"
                name="recurring-edit-scope"
                value="single"
                checked={recurringEditScope === "single"}
                onChange={() => setRecurringEditScope("single")}
                className="mt-0.5"
              />
              <span>
                <span className="block font-medium">Somente esta ocorrência</span>
                <span className="block text-xs text-muted-foreground">
                  Altera apenas este lançamento; demais meses/parcelas permanecem com os valores originais
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/50 p-3 text-sm transition-colors hover:bg-muted/50">
              <input
                type="radio"
                name="recurring-edit-scope"
                value="series"
                checked={recurringEditScope === "series"}
                onChange={() => setRecurringEditScope("series")}
                className="mt-0.5"
              />
              <span>
                <span className="block font-medium">Toda a série recorrente / parcelamento</span>
                <span className="block text-xs text-muted-foreground">
                  Regenera todas as ocorrências/parcelas (preserva valores já editados manualmente)
                </span>
              </span>
            </label>
          </div>
        </div>
      )}

      {(transaction?.isRecurring || transaction?.isInstallment || !!transaction?.installmentGroupId) && fromGrouped && (
        <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
          <div className="p-2 bg-primary/10 rounded-lg text-primary flex items-center justify-center">
            <Info className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              Aplicando alterações:{" "}
              <span className="text-primary font-semibold">
                {recurringEditScope === "single"
                  ? "Somente esta ocorrência"
                  : "Toda a série recorrente"}
              </span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {recurringEditScope === "single"
                ? "Como você clicou para editar a parcela individualmente na visualização por agrupados, a alteração se aplica apenas a este vencimento."
                : "Como você clicou para editar a recorrência/parcelamento inteiro na visualização por agrupados, as alterações se aplicarão a toda a série."}
            </p>
          </div>
        </div>
      )}

      <StepWizard
        steps={transactionSteps}
        allowClickAhead={true}
        stepValidators={stepValidators}
      >
        {/* Step 1: Type Selection */}
        <FormStepCard contentDisabled={isReadOnly}>
          <TypeSelectorStep
            type={adaptedFormData.type}
            onTypeChange={(type) => setFormData((prev) => ({ ...prev, type }))}
          />
          <StepNavigation />
        </FormStepCard>

        {/* Step 2: Details */}
        <FormStepCard contentDisabled={isReadOnly}>
          <DetailsStep
            formData={adaptedFormData}
            onChange={handleChange}
            isProposalTransaction={!!isProposalTransaction}
            groupInfo={
              transaction?.isInstallment && relatedInstallments.length > 0
                ? {
                    currentTotal: totalValueOverride || 0,
                    number: transaction.installmentNumber || 1,
                    count: transaction.installmentCount || 1,
                  }
                : undefined
            }
          />
          <StepNavigation />
        </FormStepCard>

        {/* Step 3: Payment */}
        <FormStepCard contentDisabled={isReadOnly}>
          <PaymentStep
            formData={adaptedFormData}
            onFormDataChange={(updater) => {
              if (typeof updater === "function") {
                setFormData((prev) => {
                  // Ensure types match TransactionFormData (clientId must be string)
                  const prevAsTransactionFormData: TransactionFormData = {
                    ...prev,
                    clientId: prev.clientId || "",
                  };

                  const result = updater(prevAsTransactionFormData);

                  return result as unknown as EditTransactionFormData;
                });
              } else {
                setFormData(updater as unknown as EditTransactionFormData);
              }
            }}
            onChange={handlePaymentFieldChange}
            isProposalTransaction={!!isProposalTransaction}
            onPaymentModeChange={switchPaymentMode}
            errors={paymentErrors}
            recurringEditScope={recurringEditScope}
          />

          <StepNavigation onBeforeNext={validatePaymentStep} />
        </FormStepCard>

        {/* Step 4: Review */}
        <FormStepCard contentDisabled={isReadOnly}>
          <ReviewStep
            formData={adaptedFormData}
            onChange={handleChange}
            onClientChange={handleClientChange}
            totalOverride={totalValueOverride}
            installmentNumber={resolvedInstallmentNumber}
            recurringEditScope={recurringEditScope}
          />
          <StepNavigation
            onSubmit={handleFormSubmit}
            isSubmitting={isSaving}
            submitDisabled={!hasChanges || isReadOnly}
            submitLabel="Salvar Alterações"
          />
        </FormStepCard>
      </StepWizard>
    </FormContainer>
  );
}
