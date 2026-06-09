"use client";

import { FormContainer, FormHeader } from "@/components/ui/form-components";
import { TwoFactorSection } from "@/components/profile/two-factor-section";
import { ShieldCheck } from "lucide-react";

export default function SettingsSecurityPage() {
  return (
    <FormContainer>
      <FormHeader
        title="Verificação em dois fatores"
        subtitle="Proteja sua conta com uma camada extra de segurança"
        icon={ShieldCheck}
      />
      <TwoFactorSection />
    </FormContainer>
  );
}
