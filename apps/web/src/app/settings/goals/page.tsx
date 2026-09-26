"use client";

import * as React from "react";
import { Shield, Target } from "lucide-react";
import {
  FormContainer,
  FormHeader,
  FormHeaderSkeleton,
} from "@/components/ui/form-components";
import { UpgradeRequired } from "@/components/ui/upgrade-required";
import { SalesGoalsCard } from "@/app/settings/_components/sales-goals-card";
import { useReportSettingsLoading } from "@/app/settings/_components/settings-chrome";
import { SalesGoalsCardSkeleton } from "@/app/settings/_components/settings-skeleton";
import { usePermissions } from "@/providers/permissions-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";

/**
 * Metas de vendas (Pro e Enterprise). Quem define é o dono ou administrador; o
 * portão fica dentro da tela, e não em `page-config.ts`, pelo mesmo motivo da
 * numeração: `masterOnly` na rota mandaria o membro para `/403`. O membro vê o
 * próprio progresso no Dashboard.
 */
export default function SettingsGoalsPage() {
  const { isMaster, isDemo, isLoading: permLoading } = usePermissions();
  const { hasSalesGoals, isLoading: planLoading } = usePlanLimits();
  const [cardLoading, setCardLoading] = React.useState(true);
  const canConfigure = isMaster && !isDemo;
  const loading = permLoading || planLoading || (canConfigure && cardLoading);
  useReportSettingsLoading(loading);

  if (!planLoading && !hasSalesGoals) {
    return (
      <UpgradeRequired
        feature="Metas de vendas"
        description="Defina a meta do mês da empresa e de cada pessoa da equipe e acompanhe no Dashboard quanto já foi vendido. Disponível a partir do plano Pro."
      />
    );
  }

  return (
    <FormContainer>
      {loading && !canConfigure ? (
        <FormHeaderSkeleton />
      ) : (
        <FormHeader
          title="Metas de vendas"
          subtitle="A meta do mês da empresa e de cada pessoa da equipe"
          icon={Target}
        />
      )}
      {permLoading || planLoading ? (
        <SalesGoalsCardSkeleton />
      ) : canConfigure ? (
        <SalesGoalsCard onLoadingChange={setCardLoading} />
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <Shield className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground">
            {isDemo
              ? "Na conta de demonstração as metas ficam só para ver, no Dashboard."
              : "Apenas o administrador define as metas. O seu progresso aparece no Dashboard."}
          </p>
        </div>
      )}
    </FormContainer>
  );
}
