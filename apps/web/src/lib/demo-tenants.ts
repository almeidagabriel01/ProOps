import { mapNiches, nicheEntry, type TenantNicheId } from "@/lib/niches/registry";

/**
 * O tenant de demonstração de cada nicho, do registro (`lib/niches/registry.ts`,
 * espelho de `apps/functions/src/shared/niches.ts`).
 */
export const DEMO_TENANT_IDS: Record<TenantNicheId, string> = mapNiches(
  (entry) => entry.demoTenantId,
);

export const DEMO_TENANT_ID = DEMO_TENANT_IDS.automacao_residencial;

export function demoTenantIdForNiche(niche: unknown): string {
  return nicheEntry(niche).demoTenantId;
}
