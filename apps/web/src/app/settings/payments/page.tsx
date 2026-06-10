"use client";

import { FormContainer, FormHeader } from "@/components/ui/form-components";
import { AsaasConnectCard } from "@/app/settings/_components/asaas-connect-card";
import { PaymentsCardSkeleton } from "@/app/settings/_components/settings-skeleton";
import { usePermissions } from "@/providers/permissions-provider";
import { CreditCard, Shield } from "lucide-react";

export default function SettingsPaymentsPage() {
  const { isMaster, isLoading } = usePermissions();

  return (
    <FormContainer>
      <FormHeader
        title="Pagamento Online"
        subtitle="Receba pagamentos das suas propostas online via Asaas"
        icon={CreditCard}
      />
      {isLoading ? (
        <PaymentsCardSkeleton />
      ) : isMaster ? (
        <AsaasConnectCard />
      ) : (
        !isLoading && (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
            <Shield className="w-16 h-16 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground">
              Apenas o administrador pode configurar o pagamento online.
            </p>
          </div>
        )
      )}
    </FormContainer>
  );
}
