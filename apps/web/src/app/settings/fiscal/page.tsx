"use client";

import * as React from "react";
import { FileText, Shield } from "lucide-react";
import {
  FormContainer,
  FormHeader,
  FormHeaderSkeleton,
} from "@/components/ui/form-components";
import { FiscalSettingsCard } from "@/app/settings/_components/fiscal-settings-card";
import { PaymentsCardSkeleton } from "@/app/settings/_components/settings-skeleton";
import { useReportSettingsLoading } from "@/app/settings/_components/settings-chrome";
import { usePermissions } from "@/providers/permissions-provider";

export default function SettingsFiscalPage() {
  const { isMaster, isDemo, isLoading: permLoading } = usePermissions();
  // Contas demo e free são donas do próprio tenant, então veem a seção — o
  // conteúdo é renderizado somente-leitura via `inert`, como em /settings/payments.
  const canSeeSection = isMaster || isDemo;

  const [cardLoading, setCardLoading] = React.useState(true);
  const loading = permLoading || (canSeeSection && cardLoading);
  useReportSettingsLoading(loading);

  return (
    <FormContainer>
      {loading ? (
        <FormHeaderSkeleton />
      ) : (
        <FormHeader
          title="Notas Fiscais"
          subtitle="Configure sua empresa para emitir NF-e de produto e NFS-e de serviço"
          icon={FileText}
        />
      )}
      {permLoading ? (
        <PaymentsCardSkeleton />
      ) : canSeeSection ? (
        <div className="contents" inert={isDemo || undefined}>
          <FiscalSettingsCard onLoadingChange={setCardLoading} />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <Shield className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground">
            Apenas o administrador pode configurar a emissão de notas fiscais.
          </p>
        </div>
      )}
    </FormContainer>
  );
}
