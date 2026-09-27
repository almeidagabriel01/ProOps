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

/** Parâmetro da URL do cadastro que traz o nicho da landing de origem. */
export const SIGNUP_NICHE_PARAM = "nicho";

/**
 * Nicho com que o cadastro abre: o da landing de onde a pessoa veio
 * (`/register?nicho=cortinas`), ou automação quando não veio de nenhuma ou o
 * valor não é um nicho.
 */
export function signupNicheFromParam(value: string | null | undefined): TenantNicheId {
  return isTenantNiche(value) ? value : "automacao_residencial";
}

export function signupHrefForNiche(niche: TenantNicheId): string {
  return `/register?${SIGNUP_NICHE_PARAM}=${niche}`;
}
