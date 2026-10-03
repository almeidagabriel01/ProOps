import {
  getChargeableQuantityFromPricingDetails,
  type ProposalProductPricingDetails,
} from "@/lib/product-pricing";

/**
 * Estoque ao montar a proposta: quanto a proposta inteira usa de cada produto
 * e se isso passa do que há no catálogo. É só aviso; a proposta não baixa
 * estoque (quem baixa é a ordem de serviço).
 *
 * O mesmo produto pode estar em vários ambientes, então o consumo soma todas as
 * linhas. A linha cobrada por medida consome na unidade do estoque dela (metro
 * ou m²), que é a quantidade cobrável, e não o número de peças. A linha
 * "Inativa" conta: ela só some do PDF e continua na venda.
 */

interface StockLine {
  productId: string;
  itemType?: "product" | "service";
  quantity?: number;
  pricingDetails?: ProposalProductPricingDetails | null;
}

interface StockProduct {
  itemType?: "product" | "service";
  inventoryValue?: unknown;
  stock?: unknown;
}

export interface ProductStockStatus {
  stock: number;
  used: number;
  exceeded: boolean;
}

export function proposalStockUsage(lines: readonly StockLine[]): Map<string, number> {
  const usage = new Map<string, number>();
  for (const line of lines) {
    if (line.itemType === "service" || !line.productId) continue;
    const consumed = getChargeableQuantityFromPricingDetails(line.pricingDetails, line.quantity ?? 0);
    if (consumed <= 0) continue;
    usage.set(line.productId, roundStock((usage.get(line.productId) ?? 0) + consumed));
  }
  return usage;
}

/** Saldo do produto no catálogo; `null` quando não há saldo a acompanhar (serviço). */
export function productStock(product: StockProduct): number | null {
  if (product.itemType === "service") return null;
  if (typeof product.inventoryValue === "number" && Number.isFinite(product.inventoryValue)) {
    return product.inventoryValue;
  }
  if (typeof product.stock === "number" && Number.isFinite(product.stock)) return product.stock;
  return null;
}

export function productStockStatus(product: StockProduct, used: number): ProductStockStatus | null {
  const stock = productStock(product);
  if (stock === null) return null;
  return { stock, used, exceeded: used > 0 && roundStock(used) > roundStock(stock) };
}

function roundStock(value: number): number {
  return Math.round(value * 1000) / 1000;
}
