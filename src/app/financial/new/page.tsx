"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Wallet } from "lucide-react";
import { useTransactionForm } from "../_hooks/useTransactionForm";
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
import { TrendingUp, FileText, CreditCard, CheckCircle } from "lucide-react";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { usePagePermission } from "@/hooks/usePagePermission";
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

export default function NewTransactionPage() {
  const router = useRouter();
  const { hasFinancial, isLoading: planLoading } = usePlanLimits();
  const { canCreate, isLoading: permLoading } = usePagePermission("financial");
  const {
    formData,
    setFormData,
    handleChange,
    handleBlur,
    handleClientChange,
    handleSubmit,
    errors,
    setFieldError,
    isSaving,
    isLoading,
    switchPaymentMode,
  } = useTransactionForm();

  // Redirect if no create permission
  useEffect(() => {
    if (!permLoading && !canCreate) {
      router.push("/financial");
    }
  }, [permLoading, canCreate, router]);

  // Show loading first - before checking plan access to avoid flash
  if (isLoading || planLoading || permLoading || !canCreate) {
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
        feature="Novo Lançamento"
        description="O módulo Financeiro permite gerenciar suas receitas, despesas e fluxo de caixa. Faça upgrade para o plano Profissional ou Enterprise para acessar."
      />
    );
  }

  const handleFormSubmit = async () => {
    const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
    await handleSubmit(fakeEvent);
  };

  // Step 2 validation: Description, date are required.
  const validateStep2 = (): boolean => {
    let isValid = true;

    if (!formData.description.trim()) {
      setFieldError("description", "Descrição é obrigatória");
      isValid = false;
    }
    if (!formData.date) {
      setFieldError("date", "Data é obrigatória");
      isValid = false;
    }

    return isValid;
  };

  // Step 3 validation: Amount/Value and Wallet are required based on payment mode
  const validateStep3 = (): boolean => {
    let isValid = true;

    if (formData.paymentMode === "total") {
      // Total mode: amount, dueDate (for income), and wallet are required
      if (!formData.amount || parseFloat(formData.amount) <= 0) {
        setFieldError("amount", "Valor deve ser maior que 0");
        isValid = false;
      }

      // dueDate is required only for income (receita)
      if (formData.type === "income" && !formData.dueDate) {
        setFieldError("dueDate", "Vencimento é obrigatório para receitas");
        isValid = false;
      } else if (formData.date && formData.dueDate) {
        // Check if dueDate is not before date - parse date parts to avoid timezone issues
        const [yearD, monthD, dayD] = formData.date.split("-").map(Number);
        const [yearDue, monthDue, dayDue] = formData.dueDate
          .split("-")
          .map(Number);
        const date = new Date(yearD, monthD - 1, dayD);
        const dueDate = new Date(yearDue, monthDue - 1, dayDue);
        date.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);
        if (dueDate < date) {
          setFieldError("dueDate", "Vencimento não pode ser anterior à data");
          isValid = false;
        }
      }

      if (!formData.wallet || formData.wallet.trim() === "") {
        setFieldError("wallet", "Carteira é obrigatória");
        isValid = false;
      }
    } else {
      // Installment value mode: installmentValue and installmentsWallet are required
      if (formData.isInstallment) {
        if (
          !formData.installmentValue ||
          parseFloat(formData.installmentValue) <= 0
        ) {
          setFieldError(
            "installmentValue",
            "Valor da parcela deve ser maior que 0",
          );
          isValid = false;
        }
        if (
          !formData.installmentsWallet ||
          formData.installmentsWallet.trim() === ""
        ) {
          setFieldError(
            "installmentsWallet",
            "Carteira para parcelas é obrigatória",
          );
          isValid = false;
        }
        if (formData.downPaymentEnabled) {
          if (
            !formData.downPaymentValue ||
            parseFloat(formData.downPaymentValue) <= 0
          ) {
            setFieldError(
              "downPaymentValue",
              "Valor da entrada deve ser maior que 0",
            );
            isValid = false;
          }
        }
      }
    }

    return isValid;
  };

  return (
    <FormContainer className="max-w-3xl">
      <FormHeader
        title="Novo Lançamento"
        subtitle="Registre uma nova movimentação financeira"
        icon={Wallet}
        onBack={() => router.push("/financial")}
      />

      <StepWizard steps={transactionSteps}>
        {/* Step 1: Type Selection */}
        <StepCard>
          <TypeSelectorStep
            type={formData.type}
            onTypeChange={(type) => setFormData((prev) => ({ ...prev, type }))}
          />
          <StepNavigation />
        </StepCard>

        {/* Step 2: Details */}
        <StepCard>
          <DetailsStep
            formData={formData}
            onChange={handleChange}
            onBlur={handleBlur}
            errors={errors}
          />
          <StepNavigation onBeforeNext={validateStep2} />
        </StepCard>

        {/* Step 3: Payment */}
        <StepCard>
          <PaymentStep
            formData={formData}
            onFormDataChange={setFormData}
            onChange={handleChange}
            onBlur={handleBlur}
            errors={errors}
            onPaymentModeChange={switchPaymentMode}
          />
          <StepNavigation onBeforeNext={validateStep3} />
        </StepCard>

        {/* Step 4: Review */}
        <StepCard>
          <ReviewStep
            formData={formData}
            onChange={handleChange}
            onClientChange={handleClientChange}
            errors={errors}
          />
          <StepNavigation
            onSubmit={handleFormSubmit}
            isSubmitting={isSaving}
            submitLabel={
              formData.isInstallment
                ? `Criar ${formData.installmentCount} Parcelas`
                : "Salvar Lançamento"
            }
          />
        </StepCard>
      </StepWizard>
    </FormContainer>
  );
}
