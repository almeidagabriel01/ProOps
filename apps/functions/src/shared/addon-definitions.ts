import {
  type PlanCapabilities,
  type PlanNumericLimits,
  type PlanTierId,
} from "./plan-capabilities";

export type AddonId =
  | "financial"
  | "pdf_editor_partial"
  | "pdf_editor_full"
  | "crm";

export interface AddonDefinitionBackend {
  id: AddonId;
  availableForTiers: PlanTierId[];
}

/**
 * Backend source of truth for addon tier restrictions.
 * Must stay in sync with ADDON_DEFINITIONS in apps/web/src/services/addon-service.ts.
 * Frontend enforces this in the UI; backend enforces it as the security gate.
 */
export const ADDON_DEFINITIONS_BACKEND: AddonDefinitionBackend[] = [
  {
    id: "pdf_editor_partial",
    availableForTiers: ["starter"],
  },
  {
    id: "financial",
    availableForTiers: ["starter"],
  },
  {
    id: "pdf_editor_full",
    availableForTiers: ["starter"],
  },
  {
    id: "crm",
    availableForTiers: ["starter", "pro"],
  },
];

const ADDON_MAP = new Map<AddonId, AddonDefinitionBackend>(
  ADDON_DEFINITIONS_BACKEND.map((def) => [def.id, def]),
);

export function isAddonAvailableForTier(
  addonId: string,
  planTier: PlanTierId | null,
): boolean {
  if (!planTier) return false;
  const def = ADDON_MAP.get(addonId as AddonId);
  if (!def) return false;
  return def.availableForTiers.includes(planTier);
}

export function isKnownAddonId(addonId: string): addonId is AddonId {
  return ADDON_MAP.has(addonId as AddonId);
}

/**
 * Aplica os add-ons COMPRADOS por cima das capacidades do tier.
 *
 * Espelha `applyAddonsToFeatures` em apps/web/src/services/addon-service.ts —
 * que ate agora era o UNICO lugar do sistema que sabia que um add-on desbloqueia
 * modulo. Enquanto a logica viveu so no front, um Starter que pagou o add-on
 * financeiro via a tela abrir e era recusado pela Lia (`minPlan: "pro"`), porque
 * o gate do backend lia o tier e ignorava a compra.
 *
 * Funcao pura: nao le o Firestore. Quem descobre os add-ons ativos e
 * `resolveTenantCapabilities` em lib/tenant-capabilities.ts.
 */
export function applyAddonsToCapabilities(
  base: { capabilities: PlanCapabilities; limits: PlanNumericLimits },
  purchasedAddonIds: readonly string[],
): { capabilities: PlanCapabilities; limits: PlanNumericLimits } {
  const capabilities: PlanCapabilities = { ...base.capabilities };
  const limits: PlanNumericLimits = { ...base.limits };

  for (const rawId of purchasedAddonIds) {
    switch (rawId) {
      case "financial":
        capabilities.financial = true;
        break;
      case "crm":
        capabilities.crm = true;
        break;
      case "pdf_editor_partial":
        // Nunca rebaixa quem ja tem tudo (-1 = ilimitado).
        if (limits.maxPdfTemplates !== -1) {
          limits.maxPdfTemplates = Math.max(limits.maxPdfTemplates, 3);
        }
        break;
      case "pdf_editor_full":
        limits.maxPdfTemplates = -1;
        capabilities.pdfEditor = true;
        break;
      default:
        break;
    }
  }

  return { capabilities, limits };
}
