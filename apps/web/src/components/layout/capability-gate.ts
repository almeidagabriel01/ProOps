"use client";

import * as React from "react";

import { usePlanLimits } from "@/hooks/usePlanLimits";
import type { MenuCapability } from "@/components/layout/navigation-config";

/**
 * Traduz uma capacidade de plano ausente no que a UI precisa mostrar: se o item
 * está bloqueado, para qual plano empurrar e o que dizer.
 *
 * Existe porque essa mesma decisão estava copiada em quatro superfícies (dock,
 * tab bar, sheet e onboarding), cada uma com sua própria cadeia de ifs — e as
 * quatro liam `requiresEnterprise`, que nenhum item de menu declarava. Com o
 * CRM finalmente tendo entrada de menu, manter quatro cópias voltaria a ser
 * quatro chances de divergirem.
 */

export type MenuCapabilityMap = Record<MenuCapability, boolean>;

export function useMenuCapabilities(): MenuCapabilityMap {
  const { hasFinancial, hasKanban, hasFiscal } = usePlanLimits();
  return React.useMemo(
    () => ({ financial: hasFinancial, crm: hasKanban, fiscal: hasFiscal }),
    [hasFinancial, hasKanban, hasFiscal],
  );
}

export type CapabilityRestriction = {
  restricted: boolean;
  /** Plano para o qual o modal de upgrade deve empurrar. */
  requiredPlan: "pro" | "enterprise";
  description: string;
};

const CAPABILITY_COPY: Record<
  MenuCapability,
  { requiredPlan: "pro" | "enterprise"; description: string }
> = {
  financial: {
    requiredPlan: "pro",
    description: "Controle suas finanças com nosso módulo completo.",
  },
  crm: {
    requiredPlan: "enterprise",
    description:
      "O módulo CRM pode ser contratado como add-on ou vem incluído no plano Enterprise.",
  },
  fiscal: {
    requiredPlan: "enterprise",
    description:
      "Emita NF-e e NFS-e direto da proposta aprovada. Disponível no plano Enterprise.",
  },
};

export function resolveCapabilityRestriction(
  capability: MenuCapability | undefined,
  capabilities: MenuCapabilityMap,
): CapabilityRestriction {
  if (!capability) {
    return { restricted: false, requiredPlan: "pro", description: "" };
  }
  return {
    restricted: !capabilities[capability],
    ...CAPABILITY_COPY[capability],
  };
}
