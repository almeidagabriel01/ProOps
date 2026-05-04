"use client";

import { UserPlus, AlertCircle } from "lucide-react";
import { StepWizard } from "@/components/ui/step-wizard";
import { FormStepCard } from "@/components/ui/form-step-card";
import { UpgradeModal } from "@/components/ui/upgrade-modal";
import { usePlanLimits } from "@/hooks/usePlanLimits";

import { useCreateMemberForm } from "./hooks/use-create-member-form";
import { steps } from "./team-constants";
import { MemberInfoStep } from "./steps/member-info-step";
import { RoleSelectionStep } from "./steps/role-selection-step";
import { PermissionsStep } from "./steps/permissions-step";

interface CreateMemberSectionProps {
  onSuccess: () => void;
}

export function CreateMemberSection({ onSuccess }: CreateMemberSectionProps) {
  const {
    name,
    setName,
    email,
    setEmail,
    password,
    setPassword,
    phoneNumber,
    setPhoneNumber,
    selectedRole,
    customPermissions,
    setCustomPermissions,
    errors,
    showPassword,
    setShowPassword,
    handleRoleSelect,
    handleSubmit,
    validateStep1,
    isLoading,
    error,
    upgradeModal,
  } = useCreateMemberForm({ onSuccess });

  const { hasFinancial } = usePlanLimits();

  return (
    <div className="relative rounded-2xl border-2 border-dashed border-primary/30 bg-linear-to-br from-primary/5 via-background to-primary/5 overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-linear-to-br from-primary/10 to-transparent rounded-full -translate-y-32 translate-x-32" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-linear-to-tr from-primary/10 to-transparent rounded-full translate-y-24 -translate-x-24" />

      <div className="relative p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25">
            <UserPlus className="w-7 h-7 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">
              Adicionar Novo Membro
            </h2>
            <p className="text-muted-foreground">
              Convide alguém para colaborar na sua equipe
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 animate-in shake duration-200 mb-6">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <StepWizard steps={steps}>
          {/* Step 1: Informações do Membro */}
          <FormStepCard>
            <MemberInfoStep
              name={name}
              setName={setName}
              email={email}
              setEmail={setEmail}
              phoneNumber={phoneNumber}
              setPhoneNumber={setPhoneNumber}
              password={password}
              setPassword={setPassword}
              errors={errors}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              onNext={validateStep1}
            />
          </FormStepCard>

          {/* Step 2: Nível de Acesso */}
          <FormStepCard>
            <RoleSelectionStep
              selectedRole={selectedRole}
              onSelectRole={handleRoleSelect}
            />
          </FormStepCard>

          {/* Step 3: Personalizar Permissões */}
          <FormStepCard>
            <PermissionsStep
              customPermissions={customPermissions}
              setCustomPermissions={setCustomPermissions}
              hasFinancial={hasFinancial}
              onSubmit={handleSubmit}
              isSubmitting={isLoading}
            />
          </FormStepCard>
        </StepWizard>

        <p className="text-xs text-center text-muted-foreground mt-6">
          O novo membro poderá fazer login com o email e senha definidos.
        </p>

        <UpgradeModal
          open={upgradeModal.isOpen}
          onOpenChange={upgradeModal.setIsOpen}
          feature={upgradeModal.feature}
          description={upgradeModal.description}
          requiredPlan={upgradeModal.requiredPlan}
        />
      </div>
    </div>
  );
}
