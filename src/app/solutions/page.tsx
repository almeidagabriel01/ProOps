"use client";

import AutomationPage from "@/app/automation/page";
import { SelectTenantState } from "@/components/shared/select-tenant-state";
import { PageUnavailableState } from "@/components/shared/page-unavailable-state";
import { useAuth } from "@/providers/auth-provider";
import { useTenant } from "@/providers/tenant-provider";
import { getNicheConfig, isPageEnabledForNiche } from "@/lib/niches/config";

export default function SolutionsPage() {
  const { tenant, isLoading } = useTenant();
  const { user } = useAuth();

  if (!isLoading && !tenant && user?.role === "superadmin") {
    return <SelectTenantState />;
  }

  if (!isPageEnabledForNiche(tenant?.niche, "solutions")) {
    const nicheLabel = getNicheConfig(tenant?.niche).label;

    return (
      <PageUnavailableState
        title="Página indisponível para este nicho"
        description={`O nicho ${nicheLabel} não utiliza o módulo de soluções de automação. A estrutura já aceita páginas específicas por nicho, então este espaço pode ser substituído por um módulo próprio quando necessário.`}
        ctaHref="/products"
        ctaLabel="Ir para Catálogo"
      />
    );
  }

  return <AutomationPage />;
}
