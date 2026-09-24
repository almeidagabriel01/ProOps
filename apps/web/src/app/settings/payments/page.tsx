"use client";

import * as React from "react";
import {
  FormContainer,
  FormHeader,
  FormHeaderSkeleton,
} from "@/components/ui/form-components";
import { AsaasConnectCard } from "@/app/settings/_components/asaas-connect-card";
import { PaymentsCardSkeleton } from "@/app/settings/_components/settings-skeleton";
import { useReportSettingsLoading } from "@/app/settings/_components/settings-chrome";
import { usePermissions } from "@/providers/permissions-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { UpgradeRequired } from "@/components/ui/upgrade-required";
import { CreditCard, Shield } from "lucide-react";

export default function SettingsPaymentsPage() {
  const { isMaster, isDemo, isLoading: permLoading } = usePermissions();
  const { hasOnlinePayments, isLoading: planLoading } = usePlanLimits();
  // Demo/free accounts own their tenant, so they may view this section (the
  // content is rendered read-only via `inert` below).
  const canSeeSection = isMaster || isDemo;
  // The Asaas card reports its own status load; combine with the permission
  // load so the header + chrome skeleton stays up until the section is ready.
  const [asaasLoading, setAsaasLoading] = React.useState(true);
  const loading = permLoading || planLoading || (canSeeSection && asaasLoading);
  useReportSettingsLoading(loading);

  // Pagamento online é nativo só no Enterprise e vendido como add-on. Sem este
  // gate a tela abria e o card mostrava "Erro ao carregar status do Asaas",
  // que é o 402 do backend sem explicação.
  if (!planLoading && !hasOnlinePayments && !isDemo) {
    return (
      <UpgradeRequired
        feature="Pagamento Online"
        description="Seu cliente paga a parcela por Pix ou boleto direto no link compartilhado, e o lançamento baixa sozinho. Contrate o add-on de Pagamento Online ou tenha incluído no plano Enterprise."
      />
    );
  }

  return (
    <FormContainer>
      {loading ? (
        <FormHeaderSkeleton />
      ) : (
        <FormHeader
          title="Pagamento Online"
          subtitle="Receba pagamentos das suas propostas online via Asaas"
          icon={CreditCard}
        />
      )}
      {permLoading ? (
        <PaymentsCardSkeleton />
      ) : canSeeSection ? (
        <div className="contents" inert={isDemo || undefined}>
          <AsaasConnectCard onLoadingChange={setAsaasLoading} />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <Shield className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground">
            Apenas o administrador pode configurar o pagamento online.
          </p>
        </div>
      )}
    </FormContainer>
  );
}
