import { mapNiches, nicheEntry, type TenantNicheId } from "./niches";

/**
 * Tenants de demonstração: a conta free navega os dados de um deles em
 * somente-leitura (as rules liberam a leitura pela regra `isDemoRead`).
 *
 * Um por nicho, declarado em `NICHE_REGISTRY` e escolhido pelo nicho da conta.
 */
export const DEMO_TENANT_IDS: Record<TenantNicheId, string> = mapNiches(
  (entry) => entry.demoTenantId,
);

/** O de automação, que também é o de quem não tem nicho reconhecido. */
export const DEMO_TENANT_ID = DEMO_TENANT_IDS.automacao_residencial;

export function demoTenantIdForNiche(niche: unknown): string {
  return nicheEntry(niche).demoTenantId;
}
