/**
 * Cópia do front de `apps/functions/src/shared/niches.ts`: os ids de nicho que
 * a plataforma aceita. A paridade com o backend e com o `firestore.rules` é
 * garantida por `src/__tests__/niche-ids-parity.test.ts`.
 */
export const TENANT_NICHES = ["automacao_residencial", "cortinas"] as const;

export type TenantNicheId = (typeof TENANT_NICHES)[number];

export function isTenantNiche(value: unknown): value is TenantNicheId {
  return typeof value === "string" && (TENANT_NICHES as readonly string[]).includes(value);
}
