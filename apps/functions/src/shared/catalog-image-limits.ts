/**
 * Quantas imagens um item do catálogo aceita. Depende do NICHO, não do plano:
 * cortinas mostram o tecido de vários ângulos, automação usa uma foto do
 * equipamento. Igual em todos os planos.
 *
 * O número de cada nicho vem de `NICHE_REGISTRY` (`./niches`). O front aplica a
 * mesma regra (`apps/web/src/lib/catalog-image-limits.ts`), e a paridade é
 * garantida por `apps/web/src/__tests__/niche-registry-parity.test.ts`.
 *
 * Até 2026-09 o limite ficava em `PLAN_CATALOG` (2 no Starter, 3 no Pro e no
 * Enterprise), enquanto a tela aplicava esta regra de nicho: o plano prometia
 * um número que a tela não entregava, e um Starter de cortinas levava 402 ao
 * salvar a 3ª foto que a tela tinha aceitado.
 */

import { isTenantNiche, mapNiches, type TenantNicheId } from "./niches";

export type CatalogItemType = "product" | "service";

export const DEFAULT_CATALOG_IMAGE_LIMIT = 1;

/** Imagens por PRODUTO em cada nicho (serviço sempre tem uma). */
export const PRODUCT_IMAGE_LIMIT_BY_NICHE: Record<TenantNicheId, number> = mapNiches(
  (entry) => entry.productImageLimit,
);

export function resolveCatalogImageLimit(input: {
  niche: string | null | undefined;
  itemType: CatalogItemType;
}): number {
  if (input.itemType !== "product" || !isTenantNiche(input.niche)) {
    return DEFAULT_CATALOG_IMAGE_LIMIT;
  }
  return PRODUCT_IMAGE_LIMIT_BY_NICHE[input.niche];
}
