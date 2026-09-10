"use client";

import * as React from "react";
import { Hash, Shield } from "lucide-react";
import {
  FormContainer,
  FormHeader,
  FormHeaderSkeleton,
} from "@/components/ui/form-components";
import { ProposalNumberingCard } from "@/app/settings/_components/proposal-numbering-card";
import { PaymentsCardSkeleton } from "@/app/settings/_components/settings-skeleton";
import { useReportSettingsLoading } from "@/app/settings/_components/settings-chrome";
import { usePermissions } from "@/providers/permissions-provider";

/**
 * Numeração das propostas.
 *
 * Sem gate de plano: numerar documento não é módulo premium, e cobrar por isso
 * transformaria o formato interno de uma empresa em degrau de assinatura. O
 * portão aqui é só o de administrador, e ele fica DENTRO do componente, não em
 * `page-config.ts`: `masterOnly` na rota mandaria todo membro para `/403`, e
 * quem não é master simplesmente não tem o que fazer nesta tela.
 */
export default function SettingsProposalsPage() {
  const { isMaster, isLoading: permLoading } = usePermissions();

  const [cardLoading, setCardLoading] = React.useState(true);
  const loading = permLoading || (isMaster && cardLoading);
  useReportSettingsLoading(loading);

  return (
    <FormContainer>
      {loading ? (
        <FormHeaderSkeleton />
      ) : (
        <FormHeader
          title="Propostas"
          subtitle="Numeração e código das propostas da sua empresa"
          icon={Hash}
        />
      )}
      {permLoading ? (
        <PaymentsCardSkeleton />
      ) : isMaster ? (
        <ProposalNumberingCard onLoadingChange={setCardLoading} />
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <Shield className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground">
            Apenas o administrador pode alterar a numeração das propostas.
          </p>
        </div>
      )}
    </FormContainer>
  );
}
