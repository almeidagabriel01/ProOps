/**
 * Itens do catálogo usados numa proposta, num campo indexável.
 *
 * `products` é um array de objetos, e o Firestore não consulta dentro dele:
 * para saber se um produto podia ser excluído, a tela baixava TODAS as
 * propostas do tenant e procurava no navegador. `productRefs` guarda
 * `"<tipo>:<id>"` (ex.: `product:abc`, `service:xyz`) e a checagem vira um
 * `array-contains` com `limit(1)`.
 *
 * `productRefsIndexed: true` marca o doc como coberto. Enquanto houver
 * proposta do tenant sem a marca (antes do backfill-proposal-product-refs), a
 * tela cai no método antigo, e nunca libera excluir um produto em uso.
 */

export type CatalogItemKind = "product" | "service";

export function buildProductRef(itemType: CatalogItemKind, productId: string): string {
  return `${itemType}:${productId}`;
}

export function buildProposalProductRefs(products: unknown): string[] {
  if (!Array.isArray(products)) return [];
  const refs = new Set<string>();
  for (const item of products) {
    if (!item || typeof item !== "object") continue;
    const record = item as { productId?: unknown; itemType?: unknown };
    const productId = typeof record.productId === "string" ? record.productId.trim() : "";
    if (!productId) continue;
    const itemType: CatalogItemKind = record.itemType === "service" ? "service" : "product";
    refs.add(buildProductRef(itemType, productId));
  }
  return Array.from(refs);
}

/** Campos a gravar junto de `products` em toda escrita da proposta. */
export function productRefsFields(products: unknown): {
  productRefs: string[];
  productRefsIndexed: true;
} {
  return { productRefs: buildProposalProductRefs(products), productRefsIndexed: true };
}
