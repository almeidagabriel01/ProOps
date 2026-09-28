import type { NicheLandingConfig } from "@/components/landing/niche/types";
import type { TenantNiche } from "@/types";
import { nicheLanding as automacaoResidencial } from "@/lib/niches/definitions/automacao_residencial/landing";
import { nicheLanding as cortinas } from "@/lib/niches/definitions/cortinas/landing";
import { nicheLanding as segurancaEletronica } from "@/lib/niches/definitions/seguranca_eletronica/landing";
import { nicheLanding as vidracariaEsquadrias } from "@/lib/niches/definitions/vidracaria_esquadrias/landing";
import { nicheLanding as moveisPlanejados } from "@/lib/niches/definitions/moveis_planejados/landing";

/**
 * O texto da landing de cada nicho, uma pasta por nicho em
 * `lib/niches/definitions/<id>/landing.ts`.
 */
export const NICHE_LANDING_CONFIG: Record<TenantNiche, NicheLandingConfig> = {
  automacao_residencial: automacaoResidencial,
  cortinas: cortinas,
  seguranca_eletronica: segurancaEletronica,
  vidracaria_esquadrias: vidracariaEsquadrias,
  moveis_planejados: moveisPlanejados,
};
