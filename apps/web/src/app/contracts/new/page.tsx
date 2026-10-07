"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UpgradeRequired } from "@/components/ui/upgrade-required";
import { EntityLoadingState } from "@/components/shared/entity-loading-state";
import { ContractForm } from "@/components/features/field-service/contract-form";
import { useTenant } from "@/providers/tenant-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { usePagePermission } from "@/hooks/usePagePermission";
import { useSensitiveData } from "@/hooks/usePermission";

/** Novo contrato de manutenção, em etapas. */
export default function NewContractPage() {
  const router = useRouter();
  const { isReadOnly } = useTenant();
  const { hasFieldService, isLoading: planLoading } = usePlanLimits();
  const { canCreate, isLoading: permLoading } = usePagePermission("contracts");
  // O contrato nasce com a mensalidade: sem "Ver valores" não há o que montar.
  const { canSeeContractValues, isLoading: sensitiveLoading } = useSensitiveData();
  const loadingAccess = permLoading || sensitiveLoading;
  const blocked = !loadingAccess && (!canCreate || !canSeeContractValues || isReadOnly);

  React.useEffect(() => {
    if (blocked) router.replace("/contracts");
  }, [blocked, router]);

  if (planLoading || loadingAccess || blocked) return <EntityLoadingState message="Carregando..." />;
  if (!hasFieldService) {
    return (
      <UpgradeRequired
        feature="Contratos"
        description="Cobre a mensalidade de manutenção todo mês e deixe as visitas preventivas abrirem sozinhas."
      />
    );
  }
  return <ContractForm />;
}
