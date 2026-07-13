"use client";

import * as React from "react";
import {
  FormContainer,
  FormHeader,
  FormHeaderSkeleton,
} from "@/components/ui/form-components";
import { TwoFactorSection } from "@/components/profile/two-factor-section";
import { useReportSettingsLoading } from "@/app/settings/_components/settings-chrome";
import { usePermissions } from "@/providers/permissions-provider";
import { ShieldCheck } from "lucide-react";

export default function SettingsSecurityPage() {
  const { isDemo } = usePermissions();
  const [loading, setLoading] = React.useState(true);
  useReportSettingsLoading(loading);

  return (
    <FormContainer>
      {loading ? (
        <FormHeaderSkeleton />
      ) : (
        <FormHeader
          title="Verificação em dois fatores"
          subtitle="Proteja sua conta com uma camada extra de segurança"
          icon={ShieldCheck}
        />
      )}
      {/* Demo/free accounts view the flow but cannot change anything. */}
      <div className="contents" inert={isDemo || undefined}>
        <TwoFactorSection onLoadingChange={setLoading} />
      </div>
    </FormContainer>
  );
}
