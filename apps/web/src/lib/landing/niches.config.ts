import type { NicheLandingConfig } from "@/components/landing/niche/types";
import type { TenantNiche } from "@/types";
import { nicheLanding as automacaoResidencial } from "@/lib/niches/definitions/automacao_residencial/landing";
import { nicheLanding as cortinas } from "@/lib/niches/definitions/cortinas/landing";
import { nicheLanding as segurancaEletronica } from "@/lib/niches/definitions/seguranca_eletronica/landing";

/**
 * O texto da landing de cada nicho, uma pasta por nicho em
 * `lib/niches/definitions/<id>/landing.ts`.
 */
export const NICHE_LANDING_CONFIG: Record<TenantNiche, NicheLandingConfig> = {
  automacao_residencial: automacaoResidencial,
  cortinas: cortinas,
  seguranca_eletronica: segurancaEletronica,
};
