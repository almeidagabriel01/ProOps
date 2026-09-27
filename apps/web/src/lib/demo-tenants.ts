import { isTenantNiche, type TenantNicheId } from "@/lib/niches/niche-ids";

/**
 * Cópia do front de `apps/functions/src/shared/demo-tenant.ts`: o tenant de
 * demonstração de cada nicho. A paridade com o backend e com o
 * `firestore.rules` é garantida por `src/__tests__/demo-tenants-parity.test.ts`.
 */
export const DEMO_TENANT_IDS: Record<TenantNicheId, string> = {
  automacao_residencial: "demo",
  cortinas: "demo-cortinas",
};

export const DEMO_TENANT_ID = DEMO_TENANT_IDS.automacao_residencial;

export function demoTenantIdForNiche(niche: unknown): string {
  return isTenantNiche(niche) ? DEMO_TENANT_IDS[niche] : DEMO_TENANT_ID;
}
