"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { UpgradeRequired } from "@/components/ui/upgrade-required";
import { EntityLoadingState } from "@/components/shared/entity-loading-state";
import { ContractForm } from "@/components/features/field-service/contract-form";
import { useTenant } from "@/providers/tenant-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { usePagePermission } from "@/hooks/usePagePermission";
import { FieldService } from "@/services/field-service-service";
import type { ServiceContract } from "@/types/field-service";

/** Editar o contrato. Encerrado não se edita: volta para o detalhe. */
export default function EditContractPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { isReadOnly } = useTenant();
  const { hasFieldService, isLoading: planLoading } = usePlanLimits();
  const { canEdit, isLoading: permLoading } = usePagePermission("contracts");
  const [contract, setContract] = React.useState<ServiceContract | null | undefined>(undefined);

  React.useEffect(() => {
    if (!params.id) return;
    return FieldService.subscribeContract(
      params.id,
      (next) => setContract((current) => (current === undefined ? next : current)),
      () => setContract(null),
    );
  }, [params.id]);

  const blocked =
    (!permLoading && (!canEdit || isReadOnly)) || contract === null || contract?.status === "ended";

  React.useEffect(() => {
    if (blocked) router.replace(params.id ? `/contracts/${params.id}` : "/contracts");
  }, [blocked, router, params.id]);

  if (planLoading || permLoading || contract === undefined || blocked) {
    return <EntityLoadingState message="Carregando contrato..." />;
  }
  if (!hasFieldService) {
    return (
      <UpgradeRequired
        feature="Contratos"
        description="Cobre a mensalidade de manutenção todo mês e deixe as visitas preventivas abrirem sozinhas."
      />
    );
  }
  return <ContractForm contract={contract} />;
}
