"use client";

import { useRouter } from "next/navigation";
import { Loader2, Wallet } from "lucide-react";
import { useTransactionForm } from "../_hooks/useTransactionForm";
import {
  FormContainer,
  FormHeader,
} from "@/components/ui/form-components";
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
import {
  TrendingUp,
  TrendingDown,
  FileText,
  CreditCard,
  CheckCircle,
} from "lucide-react";

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
  const {
    formData,
    setFormData,
    handleChange,
    handleClientChange,
    handleSubmit,
    isSaving,
    isLoading,
  } = useTransactionForm();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  const handleFormSubmit = async () => {
    const fakeEvent = { preventDefault: () => { } } as React.FormEvent;
    await handleSubmit(fakeEvent);
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
          <DetailsStep formData={formData} onChange={handleChange} />
          <StepNavigation />
        </StepCard>

        {/* Step 3: Payment */}
        <StepCard>
          <PaymentStep
            formData={formData}
            onFormDataChange={setFormData}
            onChange={handleChange}
          />
          <StepNavigation />
        </StepCard>

        {/* Step 4: Review */}
        <StepCard>
          <ReviewStep
            formData={formData}
            onChange={handleChange}
            onClientChange={handleClientChange}
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
