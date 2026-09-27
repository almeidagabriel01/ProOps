/**
 * Quantas imagens um item do catálogo aceita. Depende do NICHO, não do plano:
 * cortinas mostram o tecido de vários ângulos, automação usa uma foto do
 * equipamento. Igual em todos os planos.
 *
 * Arquivo puro, sem import, para ser lido pelo backend (guard nas rotas) e
 * comparado com a cópia do front (`apps/web/src/lib/catalog-image-limits.ts`)
 * em `apps/web/src/__tests__/catalog-image-limits-parity.test.ts`.
 *
 * Até 2026-09 o limite ficava em `PLAN_CATALOG` (2 no Starter, 3 no Pro e no
 * Enterprise), enquanto a tela aplicava esta regra de nicho: o plano prometia
 * um número que a tela não entregava, e um Starter de cortinas levava 402 ao
 * salvar a 3ª foto que a tela tinha aceitado.
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
