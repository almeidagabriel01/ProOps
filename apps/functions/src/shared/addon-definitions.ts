import type { TenantPlanTier } from "../lib/tenant-plan-policy";

export type AddonId =
  | "financial"
  | "pdf_editor_partial"
  | "pdf_editor_full"
  | "crm";

export interface AddonDefinitionBackend {
  id: AddonId;
  availableForTiers: TenantPlanTier[];
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
  planTier: TenantPlanTier | null,
): boolean {
  if (!planTier) return false;
  const def = ADDON_MAP.get(addonId as AddonId);
  if (!def) return false;
  return def.availableForTiers.includes(planTier);
}
