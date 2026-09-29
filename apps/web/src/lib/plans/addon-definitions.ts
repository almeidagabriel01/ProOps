import type { AddonDefinition, AddonType, PlanTier } from "@/types";

// Módulo puro de propósito, pelo mesmo motivo de `default-plans.ts`: o selo de
// plano da página /funcionalidades roda em Server Component e não pode puxar o
// Firebase junto. `addon-service` reexporta daqui.
//
// Add-on definitions with metadata and feature mappings
// IMPORTANT: Prices are NOT stored here - they come ONLY from Stripe via Cloud Functions
// This ensures proper separation between dev/staging/production environments
// Espelha ADDON_DEFINITIONS_BACKEND (apps/functions/src/shared/addon-definitions.ts).
// Guard: src/__tests__/addon-definitions-parity.test.ts.
export const ADDON_DEFINITIONS: AddonDefinition[] = [
  {
    id: "pdf_editor_partial",
    name: "Editor PDF Parcial",
    description: "Acesse 3 templates do editor de PDF (sem edição de conteúdo)",
    featureKey: "maxPdfTemplates",
    featureValue: 3,
    icon: "Layout",
    order: 1,
    availableForTiers: ["starter"],
  },
  {
    id: "financial",
    name: "Módulo Financeiro",
    description: "Controle de receitas, despesas e fluxo de caixa completo",
    featureKey: "hasFinancial",
    featureValue: true,
    icon: "DollarSign",
    order: 2,
    availableForTiers: ["starter"],
  },
  {
    id: "pdf_editor_full",
    name: "Editor PDF Completo",
    description:
      "Acesso total ao editor: todos os templates + edição de conteúdo",
    featureKey: "canEditPdfSections",
    featureValue: true,
    icon: "FileEdit",
    order: 3,
    availableForTiers: ["starter"],
  },
  {
    id: "crm",
    name: "Módulo CRM",
    description: "CRM Kanban para gestão visual do funil de vendas",
    featureKey: "hasKanban",
    featureValue: true,
    icon: "Kanban",
    order: 4,
    availableForTiers: ["starter", "pro"],
  },
  {
    id: "fiscal",
    name: "Notas Fiscais",
    description:
      "Emissão de NF-e e NFS-e a partir das propostas e lançamentos, até 100 notas por mês",
    featureKey: "hasFiscal",
    featureValue: true,
    icon: "Receipt",
    order: 5,
    availableForTiers: ["starter", "pro"],
  },
  {
    id: "online_payments",
    name: "Pagamento Online",
    description:
      "Seu cliente paga a parcela por Pix ou boleto direto no link compartilhado",
    featureKey: "hasOnlinePayments",
    featureValue: true,
    icon: "CreditCard",
    order: 6,
    availableForTiers: ["starter", "pro"],
    requiresAddons: { starter: ["financial"] },
  },
];

/** Franquia mensal do add-on fiscal. Espelha FISCAL_ADDON_MONTHLY_INVOICES do backend. */
export const FISCAL_ADDON_MONTHLY_INVOICES = 100;

/** Add-ons que um tier pode comprar. */
export function addonsDisponiveisPara(tier: PlanTier): AddonDefinition[] {
  return ADDON_DEFINITIONS.filter((addon) => addon.availableForTiers.includes(tier));
}

/**
 * Get effective feature value considering add-ons
 * This merges base plan features with purchased add-ons
 */
export function applyAddonsToFeatures<
  T extends {
    hasFinancial: boolean;
    canEditPdfSections: boolean;
    maxPdfTemplates: number;
    hasKanban: boolean;
    hasFiscal?: boolean;
    maxInvoicesPerMonth?: number;
    hasOnlinePayments?: boolean;
  },
>(baseFeatures: T, purchasedAddons: readonly AddonType[]): T {
  const result = { ...baseFeatures };

  for (const addonType of purchasedAddons) {
    const definition = ADDON_DEFINITIONS.find((a) => a.id === addonType);
    if (!definition) continue;

    switch (addonType) {
      case "financial":
        result.hasFinancial = true;
        break;
      case "pdf_editor_partial":
        // 3 templates, no content editing (like Pro plan)
        if (result.maxPdfTemplates !== -1) {
          result.maxPdfTemplates = Math.max(result.maxPdfTemplates, 3);
        }
        break;
      case "pdf_editor_full":
        // Full access: unlimited templates + content editing
        result.maxPdfTemplates = -1; // Unlimited
        result.canEditPdfSections = true;
        break;
      case "crm":
        result.hasKanban = true;
        break;
      case "fiscal":
        // A recepção de notas de entrada não entra: é só Enterprise.
        result.hasFiscal = true;
        if (result.maxInvoicesPerMonth !== -1) {
          result.maxInvoicesPerMonth = Math.max(
            result.maxInvoicesPerMonth ?? 0,
            FISCAL_ADDON_MONTHLY_INVOICES,
          );
        }
        break;
      case "online_payments":
        result.hasOnlinePayments = true;
        break;
    }
  }

  return result;
}
