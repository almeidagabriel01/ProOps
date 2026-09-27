import { isTenantNiche, mapNiches, type TenantNicheId } from "@/lib/niches/registry";

/**
 * O limite de imagens por item do catálogo depende do nicho, não do plano. Vem
 * do registro (`lib/niches/registry.ts`, espelho do backend), e a regra é a
 * mesma de `apps/functions/src/shared/catalog-image-limits.ts`.
 */

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
