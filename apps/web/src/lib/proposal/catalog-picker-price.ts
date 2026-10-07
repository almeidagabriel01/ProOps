import {
  calculateSellingPrice,
  getProductBasePrice,
  getProductMarkup,
} from "@/lib/product-pricing";

type PricedCatalogItem = Parameters<typeof getProductBasePrice>[0];

/**
 * O preço que o seletor de produto da proposta mostra. Quem vê o custo segue
 * vendo o custo (é o que o seletor sempre mostrou); quem não vê, o preço de
 * venda, que é o que entra na linha.
 */
export function catalogPickerPrice(product: PricedCatalogItem, canSeeCost: boolean): number {
  const cost = getProductBasePrice(product);
  return canSeeCost ? cost : calculateSellingPrice(cost, getProductMarkup(product));
}

/**
 * O unitário de uma linha da proposta para exibir. Na linha gravada,
 * `unitPrice` é o CUSTO; quem não vê o custo vê o unitário de venda, tirado do
 * total da linha (o mesmo que o PDF mostra).
 */
export function proposalLineDisplayUnitPrice(
  line: { unitPrice?: number; markup?: number; quantity?: number; total?: number },
  canSeeCost: boolean,
): number {
  const cost = Number(line.unitPrice) || 0;
  if (canSeeCost) return cost;
  const quantity = Number(line.quantity) || 0;
  const total = Number(line.total);
  if (quantity > 0 && Number.isFinite(total)) return total / quantity;
  return calculateSellingPrice(cost, Number(line.markup) || 0);
}
