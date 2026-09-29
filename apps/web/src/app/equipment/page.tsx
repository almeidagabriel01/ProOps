"use client";

import { UpgradeRequired } from "@/components/ui/upgrade-required";
import { SelectTenantState } from "@/components/shared/select-tenant-state";
import { PageViewSwitcher } from "@/components/layout/page-view-switcher";
import { EquipmentList } from "@/components/features/field-service/equipment-list";
import { useTenant } from "@/providers/tenant-provider";
import { useAuth } from "@/providers/auth-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { ServiceOrdersSkeleton } from "../service-orders/_components/service-orders-skeleton";

/** Equipamentos: o que está instalado em cada cliente, com garantia e último atendimento. */
export default function EquipmentPage() {
  const { tenant } = useTenant();
  const { user } = useAuth();
  const { hasFieldService, isLoading: isPlanLoading } = usePlanLimits();

  if (!user) return null;
  if (user.role === "superadmin" && !tenant) {
    return <SelectTenantState title="Selecione uma empresa para ver os equipamentos" />;
  }
  if (isPlanLoading) return <ServiceOrdersSkeleton />;
  if (!hasFieldService && user.role !== "superadmin") {
    return (
      <UpgradeRequired
        feature="Equipamentos"
        description="Registre os aparelhos de cada cliente, com garantia e histórico de atendimentos, e abra a ordem de serviço direto do equipamento. Incluído nos planos Pro e Enterprise, ou como add-on no Starter."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Equipamentos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O que está instalado em cada cliente, com garantia e último atendimento.
        </p>
        <PageViewSwitcher className="mt-3" />
      </div>
      <EquipmentList />
    </div>
  );
}
