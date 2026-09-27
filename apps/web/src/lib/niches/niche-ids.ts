/**
 * Os ids de nicho e os helpers do cadastro. A lista vem do registro
 * (`lib/niches/registry.ts`); este arquivo continua existindo porque é o ponto
 * de import de quem só precisa do id.
 */
export {
  DEFAULT_NICHE,
  TENANT_NICHES,
  isTenantNiche,
  type TenantNicheId,
} from "@/lib/niches/registry";
import { DEFAULT_NICHE, isTenantNiche, type TenantNicheId } from "@/lib/niches/registry";

/** Parâmetro da URL do cadastro que traz o nicho da landing de origem. */
export const SIGNUP_NICHE_PARAM = "nicho";

/**
 * Nicho com que o cadastro abre: o da landing de onde a pessoa veio
 * (`/register?nicho=cortinas`), ou automação quando não veio de nenhuma ou o
 * valor não é um nicho.
 */
export function signupNicheFromParam(value: string | null | undefined): TenantNicheId {
  return isTenantNiche(value) ? value : DEFAULT_NICHE;
}

export function signupHrefForNiche(niche: TenantNicheId): string {
  return `/register?${SIGNUP_NICHE_PARAM}=${niche}`;
}
