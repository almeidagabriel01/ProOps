"use client";

import AutomationPage from "@/app/automation/page";
import { SelectTenantState } from "@/components/shared/select-tenant-state";
import { PageUnavailableState } from "@/components/shared/page-unavailable-state";
import { useAuth } from "@/providers/auth-provider";
import { useTenant } from "@/providers/tenant-provider";
import { getNicheConfig, isPageEnabledForNiche } from "@/lib/niches/config";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SolutionsPage() {
  const { tenant, isLoading } = useTenant();
  const { user } = useAuth();
  const router = useRouter();

  const solutionsDisabled = !isLoading && !isPageEnabledForNiche(tenant?.niche, "solutions");

  // Cortinas niche uses /ambientes — redirect if someone lands here
  useEffect(() => {
    if (solutionsDisabled && isPageEnabledForNiche(tenant?.niche, "ambientes")) {
      router.replace("/ambientes");
    }
  }, [solutionsDisabled, tenant?.niche, router]);

  if (!isLoading && !tenant && user?.role === "superadmin") {
    return <SelectTenantState />;
  }

  if (solutionsDisabled) {
    const nicheLabel = getNicheConfig(tenant?.niche).label;

    return (
      <PageUnavailableState
        title="Página indisponível para este nicho"
        description={`O nicho ${nicheLabel} não utiliza o módulo de soluções de automação.`}
        ctaHref="/products"
        ctaLabel="Ir para Catálogo"
      />
    );
  }

  return <AutomationPage />;
}
