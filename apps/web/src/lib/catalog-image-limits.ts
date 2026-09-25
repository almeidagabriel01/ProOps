/**
 * Cópia do front de `apps/functions/src/shared/catalog-image-limits.ts`: o
 * limite de imagens por item do catálogo depende do nicho, não do plano. A
 * paridade é garantida por `src/__tests__/catalog-image-limits-parity.test.ts`.
 */

export type CatalogItemType = "product" | "service";

export const CORTINAS_PRODUCT_IMAGE_LIMIT = 3;
export const DEFAULT_CATALOG_IMAGE_LIMIT = 1;

export function resolveCatalogImageLimit(input: {
  niche: string | null | undefined;
  itemType: CatalogItemType;
}): number {
  if (input.itemType === "product" && input.niche === "cortinas") {
    return CORTINAS_PRODUCT_IMAGE_LIMIT;
  }
  return DEFAULT_CATALOG_IMAGE_LIMIT;
}
