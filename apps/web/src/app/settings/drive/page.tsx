"use client";

import * as React from "react";
import { FolderOpen, Shield } from "lucide-react";
import {
  FormContainer,
  FormHeader,
  FormHeaderSkeleton,
} from "@/components/ui/form-components";
import { DriveSettingsCard } from "@/app/settings/_components/drive-settings-card";
import { PaymentsCardSkeleton } from "@/app/settings/_components/settings-skeleton";
import { useReportSettingsLoading } from "@/app/settings/_components/settings-chrome";
import { usePermissions } from "@/providers/permissions-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { UpgradeRequired } from "@/components/ui/upgrade-required";

export default function SettingsDrivePage() {
  const { isMaster, isLoading: permLoading } = usePermissions();
  const { hasDriveSync, isLoading: planLoading } = usePlanLimits();

  const [cardLoading, setCardLoading] = React.useState(true);
  const loading = permLoading || planLoading || (isMaster && cardLoading);
  useReportSettingsLoading(loading);

  // Fora do modo demo de propósito, como o fiscal: a tela pede uma conta Google
  // real e uma pasta real, e não há o que demonstrar em somente-leitura.
  if (!planLoading && !hasDriveSync) {
    return (
      <UpgradeRequired
        feature="Google Drive"
        description="Cada cliente ganha uma pasta no seu Drive, e toda proposta enviada cai nela sozinha — sem baixar e subir à mão. Disponível a partir do plano Pro."
      />
    );
  }

  return (
    <FormContainer>
      {loading ? (
        <FormHeaderSkeleton />
      ) : (
        <FormHeader
          title="Google Drive"
          subtitle="Entregue a proposta na pasta do cliente, no seu próprio Drive"
          icon={FolderOpen}
        />
      )}
      {permLoading ? (
        <PaymentsCardSkeleton />
      ) : isMaster ? (
        <DriveSettingsCard onLoadingChange={setCardLoading} />
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <Shield className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground">
            Apenas o administrador pode conectar o Google Drive da empresa.
          </p>
        </div>
      )}
    </FormContainer>
  );
}
