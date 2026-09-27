/**
 * Cópia do front de `apps/functions/src/shared/catalog-image-limits.ts`: o
 * limite de imagens por item do catálogo depende do nicho, não do plano. A
 * paridade é garantida por `src/__tests__/catalog-image-limits-parity.test.ts`.
 */

export type CatalogItemType = "product" | "service";

export const DEFAULT_CATALOG_IMAGE_LIMIT = 1;

/**
 * Imagens por PRODUTO em cada nicho (serviço sempre tem uma). A chave é o id
 * do nicho; nicho fora do mapa fica com o padrão.
 */
export const PRODUCT_IMAGE_LIMIT_BY_NICHE: Readonly<Record<string, number>> = {
  automacao_residencial: DEFAULT_CATALOG_IMAGE_LIMIT,
  cortinas: 3,
};

export function resolveCatalogImageLimit(input: {
  niche: string | null | undefined;
  itemType: CatalogItemType;
}): number {
  if (input.itemType !== "product" || !input.niche) {
    return DEFAULT_CATALOG_IMAGE_LIMIT;
  }
  return Object.prototype.hasOwnProperty.call(PRODUCT_IMAGE_LIMIT_BY_NICHE, input.niche)
    ? PRODUCT_IMAGE_LIMIT_BY_NICHE[input.niche]
    : DEFAULT_CATALOG_IMAGE_LIMIT;
}
