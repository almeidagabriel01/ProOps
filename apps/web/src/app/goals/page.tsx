"use client";

import * as React from "react";
import { Shield } from "lucide-react";
import { PageViewSwitcher } from "@/components/layout/page-view-switcher";
import { UpgradeRequired } from "@/components/ui/upgrade-required";
import { usePermissions } from "@/providers/permissions-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { SalesGoalsPanel } from "./_components/sales-goals-panel";
import { GoalsSkeleton } from "./_components/goals-skeleton";

/**
 * Metas de vendas (Pro e Enterprise), uma visão do grupo Financeiro. Quem
 * define é o dono ou administrador; o portão fica dentro da tela, e não em
 * `page-config.ts`, para o membro que abrir pela URL ler o motivo em vez de
 * cair em `/403`. O membro vê o próprio progresso no Dashboard.
 */
export default function GoalsPage() {
  const { isMaster, isDemo, isLoading: permLoading } = usePermissions();
  const { hasSalesGoals, isLoading: planLoading } = usePlanLimits();
  const canConfigure = isMaster && !isDemo;

  if (permLoading || planLoading) return <GoalsSkeleton />;

  if (!hasSalesGoals) {
    return (
      <UpgradeRequired
        feature="Metas de vendas"
        description="Defina a meta do mês da empresa e de cada pessoa da equipe e acompanhe no Dashboard quanto já foi vendido. Disponível a partir do plano Pro."
      />
    );
  }

  const header = (
    <div>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Metas de vendas</h1>
      <p className="mt-1 text-muted-foreground">
        Quanto a empresa e cada pessoa da equipe querem vender no mês, e quanto já venderam
      </p>
      <PageViewSwitcher className="mt-3" />
    </div>
  );

  if (canConfigure) return <SalesGoalsPanel header={header} />;

  return (
    <div className="space-y-6">
      {header}
      <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
        <Shield className="mb-4 h-16 w-16 text-muted-foreground" />
        <h2 className="mb-2 text-2xl font-bold">Acesso Restrito</h2>
        <p className="text-muted-foreground">
          {isDemo
            ? "Na conta de demonstração as metas ficam só para ver, no Dashboard."
            : "Apenas o administrador define as metas. O seu progresso aparece no Dashboard."}
        </p>
      </div>
    </div>
  );
}
