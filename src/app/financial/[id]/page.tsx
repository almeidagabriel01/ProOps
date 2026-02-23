"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Wallet, AlertCircle } from "lucide-react";
import {
  useEditTransaction,
  EditTransactionFormData,
} from "../_hooks/useEditTransaction";
import { FormContainer, FormHeader } from "@/components/ui/form-components";
import {
  StepWizard,
  StepNavigation,
  StepCard,
} from "@/components/ui/step-wizard";
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
  } = useEditTransaction();

  // Adapt formData type for shared components
  // Moved to top and handled null transaction
  const adaptedFormData: TransactionFormData = React.useMemo(
    () => ({
      ...formData,
      clientId: formData.clientId || "",
      isInstallment: formData.isInstallment,
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
        const percentage = parseFloat(adaptedFormData.downPaymentPercentage || "0");
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

    if (adaptedFormData.downPaymentEnabled && !adaptedFormData.downPaymentDueDate) {
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
    if (!transaction?.isInstallment || relatedInstallments.length === 0)
      return undefined;

    // If it's a proposal group, use the explicit group total value
    if (isProposalTransaction && groupTotalValue) {
      return groupTotalValue;
    }

    // For standard installment groups (or new ones), formData.amount IS now the total
    return parseFloat(formData.amount || "0");
  }, [
    transaction,
    isProposalTransaction,
    groupTotalValue,
    formData.amount,
    relatedInstallments.length,
  ]);

  // Show loading first - before checking plan access to avoid flash
  if (isLoading || planLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
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
            onClick={() => router.push("/financial")}
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
      <FormContainer className="max-w-3xl">
        <FormHeader
          title="Visualizar Lançamento"
          subtitle="Detalhes do lançamento financeiro"
          icon={Wallet}
          onBack={() => router.push("/financial")}
        />

        <ReviewStep
          formData={adaptedFormData}
          onChange={() => {}}
          onClientChange={() => {}}
          totalOverride={totalValueOverride}
        />

        <div className="flex justify-end pt-6">
          <button
            onClick={() => router.push("/financial")}
            className="h-12 px-6 rounded-xl bg-card border border-border/50 text-sm font-medium hover:bg-muted transition-colors"
          >
            Voltar
          </button>
        </div>
      </FormContainer>
    );
  }

  return (
    <FormContainer className="max-w-3xl">
      <FormHeader
        title="Editar Lançamento"
        subtitle="Atualize as informações do lançamento"
        icon={Wallet}
        onBack={() => router.push("/financial")}
      />

      <StepWizard
        steps={transactionSteps}
        allowClickAhead={true}
        stepValidators={stepValidators}
      >
        {/* Step 1: Type Selection */}
        <StepCard>
          <TypeSelectorStep
            type={adaptedFormData.type}
            onTypeChange={(type) => setFormData((prev) => ({ ...prev, type }))}
          />
          <StepNavigation />
        </StepCard>

        {/* Step 2: Details */}
        <StepCard>
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
        </StepCard>

        {/* Step 3: Payment */}
        <StepCard>
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
          />

          <StepNavigation onBeforeNext={validatePaymentStep} />
        </StepCard>

        {/* Step 4: Review */}
        <StepCard>
          <ReviewStep
            formData={adaptedFormData}
            onChange={handleChange}
            onClientChange={handleClientChange}
            totalOverride={totalValueOverride}
          />
          <StepNavigation
            onSubmit={handleFormSubmit}
            isSubmitting={isSaving}
            submitDisabled={!hasChanges}
            submitLabel="Salvar Alterações"
          />
        </StepCard>
      </StepWizard>
    </FormContainer>
  );
}
