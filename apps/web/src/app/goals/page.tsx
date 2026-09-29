"use client";

import * as React from "react";
import { Shield } from "lucide-react";
import { PageViewSwitcher } from "@/components/layout/page-view-switcher";
import { UpgradeRequired } from "@/components/ui/upgrade-required";
import { usePermissions } from "@/providers/permissions-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { SalesGoalsCard } from "./_components/sales-goals-card";
import { SalesGoalsCardSkeleton } from "./_components/goals-skeleton";

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

  if (!planLoading && !hasSalesGoals) {
    return (
      <UpgradeRequired
        feature="Metas de vendas"
        description="Defina a meta do mês da empresa e de cada pessoa da equipe e acompanhe no Dashboard quanto já foi vendido. Disponível a partir do plano Pro."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Metas de vendas
        </h1>
        <p className="mt-1 text-muted-foreground">
          A meta do mês da empresa e de cada pessoa da equipe
        </p>
        <PageViewSwitcher className="mt-3" />
      </div>

      <div className="max-w-4xl">
        {permLoading || planLoading ? (
          <SalesGoalsCardSkeleton />
        ) : canConfigure ? (
          <SalesGoalsCard />
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
      </div>
    </div>
  );
}
