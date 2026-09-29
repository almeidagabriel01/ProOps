"use client";

import * as React from "react";

import { usePlanLimits } from "@/hooks/usePlanLimits";
import type {
  MenuCapability,
  MenuCapabilityMap,
} from "@/components/layout/navigation-config";

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

export type { MenuCapabilityMap };

export function useMenuCapabilities(): MenuCapabilityMap {
  const {
    hasFinancial,
    hasKanban,
    hasFiscal,
    hasProjects,
    hasSalesGoals,
    hasBookingLink,
    hasFieldService,
  } = usePlanLimits();
  return React.useMemo(
    () => ({
      financial: hasFinancial,
      crm: hasKanban,
      fiscal: hasFiscal,
      projects: hasProjects,
      salesGoals: hasSalesGoals,
      bookingLink: hasBookingLink,
      fieldService: hasFieldService,
    }),
    [
      hasFinancial,
      hasKanban,
      hasFiscal,
      hasProjects,
      hasSalesGoals,
      hasBookingLink,
      hasFieldService,
    ],
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
      "Emita NF-e e NFS-e direto da proposta aprovada. Contrate como add-on ou tenha incluído no plano Enterprise.",
  },
  projects: {
    requiredPlan: "pro",
    description:
      "Acompanhe cada obra depois da venda: etapas, checklist, fotos, técnico responsável e o aceite do cliente na entrega.",
  },
  salesGoals: {
    requiredPlan: "pro",
    description:
      "Defina a meta do mês da empresa e de cada pessoa da equipe e acompanhe no Dashboard quanto já foi vendido.",
  },
  bookingLink: {
    requiredPlan: "pro",
    description:
      "Mande ao cliente um link para ele escolher um horário livre e pedir a visita, que entra na Agenda para você confirmar.",
  },
  fieldService: {
    requiredPlan: "pro",
    description:
      "Registre os equipamentos de cada cliente e atenda chamados com ordem de serviço: o técnico preenche no celular e o cliente assina na tela.",
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
