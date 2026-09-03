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
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { UpgradeRequired } from "@/components/ui/upgrade-required";

export default function SettingsFiscalPage() {
  const { isMaster, isDemo, isLoading: permLoading } = usePermissions();
  const { hasFiscal, isLoading: planLoading } = usePlanLimits();
  // Contas demo e free são donas do próprio tenant, então veem a seção — o
  // conteúdo é renderizado somente-leitura via `inert`, como em /settings/payments.
  const canSeeSection = isMaster || isDemo;

  const [cardLoading, setCardLoading] = React.useState(true);
  const loading = permLoading || planLoading || (canSeeSection && cardLoading);
  useReportSettingsLoading(loading);

  // Esta tela cadastra CNPJ, sobe certificado A1 e registra a empresa no
  // provedor — o começo do fluxo que emite documento fiscal com custo por nota.
  // Gatear /invoices sem gatear aqui deixaria a porta dos fundos aberta.
  if (!planLoading && !hasFiscal && !isDemo) {
    return (
      <UpgradeRequired
        feature="Notas Fiscais"
        description="Emita NF-e e NFS-e direto da proposta aprovada, com arquivamento legal do XML e do DANFE. Disponível no plano Enterprise."
      />
    );
  }

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
