import { isTenantNiche, type TenantNicheId } from "./niches";

/**
 * Tenants de demonstração: a conta free navega os dados de um deles em
 * somente-leitura (as rules liberam a leitura pela regra `isDemoRead`).
 *
 * Um por nicho, escolhido pelo nicho da conta: quem se cadastra em persianas
 * vê um catálogo por medida e propostas por ambiente, não o de automação. A
 * lista tem cópia no front (`apps/web/src/lib/demo-tenants.ts`) e no
 * `firebase/firestore.rules`, comparadas em
 * `apps/web/src/__tests__/demo-tenants-parity.test.ts`.
 */
export const DEMO_TENANT_IDS: Record<TenantNicheId, string> = {
  automacao_residencial: "demo",
  cortinas: "demo-cortinas",
};

/** O de automação, que também é o de quem não tem nicho reconhecido. */
export const DEMO_TENANT_ID = DEMO_TENANT_IDS.automacao_residencial;

export function demoTenantIdForNiche(niche: unknown): string {
  return isTenantNiche(niche) ? DEMO_TENANT_IDS[niche] : DEMO_TENANT_ID;
}
