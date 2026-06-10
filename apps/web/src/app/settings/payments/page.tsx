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
import { CreditCard, Shield } from "lucide-react";

export default function SettingsPaymentsPage() {
  const { isMaster, isLoading: permLoading } = usePermissions();
  // The Asaas card reports its own status load; combine with the permission
  // load so the header + chrome skeleton stays up until the section is ready.
  const [asaasLoading, setAsaasLoading] = React.useState(true);
  const loading = permLoading || (isMaster && asaasLoading);
  useReportSettingsLoading(loading);

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
      ) : isMaster ? (
        <AsaasConnectCard onLoadingChange={setAsaasLoading} />
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
