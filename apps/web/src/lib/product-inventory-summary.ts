import { Product, getProductInventoryValue } from "@/services/product-service";
import {
  calculateSellingPrice,
  CurtainHeightTier,
  getProductBasePrice,
  getHeightTierById,
  getProductMarkup,
  getProductPricingMode,
  normalizeProductPricingModel,
} from "@/lib/product-pricing";

export type HeightTierInventoryInsight = {
  productId: string;
  productName: string;
  inventoryAmount: number;
  representativeTier: CurtainHeightTier | null;
  tierCount: number;
  minHeight: number;
  maxHeight: number;
  minSellingPrice: number;
  maxSellingPrice: number;
  cost: number;
  revenue: number;
};

export type ProductInventoryBalanceSummary = {
  cost: number;
  revenue: number;
  consideredProducts: number;
  skippedProducts: number;
  heightTierInsights: HeightTierInventoryInsight[];
};

function roundBalance(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

/**
 * Saldo do estoque de um catálogo com produtos por medida.
 *
 * Produto sem estoque fica de fora em qualquer modo. Até 2026-09 o produto por
 * medida sem estoque contava como 1 m, e o por faixa de altura multiplicava o
 * estoque pela SOMA das faixas: com 5 faixas, o saldo saía 5 vezes maior. A
 * faixa de altura agora vale pelo preço da faixa mais baixa, o piso do que o
 * estoque rende; o intervalo de preços continua no detalhe do produto.
 */
export function summarizeDimensionInventoryBalance(
  products: Product[],
): ProductInventoryBalanceSummary {
  const summary: ProductInventoryBalanceSummary = {
    cost: 0,
    revenue: 0,
    consideredProducts: 0,
    skippedProducts: 0,
    heightTierInsights: [],
  };

  products.forEach((product) => {
    const pricingModel = normalizeProductPricingModel(product.pricingModel);
    const pricingMode = getProductPricingMode(product);
    const inventoryAmount = Math.max(0, getProductInventoryValue(product));

    if (inventoryAmount <= 0) {
      summary.skippedProducts += 1;
      return;
    }

    if (pricingMode === "standard") {
      const basePrice = getProductBasePrice(product);
      const sellingPrice = calculateSellingPrice(
        basePrice,
        getProductMarkup(product),
      );

      summary.cost += inventoryAmount * basePrice;
      summary.revenue += inventoryAmount * sellingPrice;
      summary.consideredProducts += 1;
      return;
    }

    if (pricingModel.mode === "curtain_height" && pricingModel.tiers.length > 0) {
      const representativeTier = getHeightTierById(product);
      const floorTier = pricingModel.tiers[0];
      const floorCost = inventoryAmount * floorTier.basePrice;
      const floorRevenue =
        inventoryAmount * calculateSellingPrice(floorTier.basePrice, floorTier.markup);
      const sellingPrices = pricingModel.tiers.map((tier) =>
        calculateSellingPrice(tier.basePrice, tier.markup),
      );

      summary.cost += floorCost;
      summary.revenue += floorRevenue;
      summary.consideredProducts += 1;

      summary.heightTierInsights.push({
        productId: product.id,
        productName: product.name,
        inventoryAmount,
        representativeTier,
        tierCount: pricingModel.tiers.length,
        minHeight: pricingModel.tiers[0]?.maxHeight || 0,
        maxHeight:
          pricingModel.tiers[pricingModel.tiers.length - 1]?.maxHeight || 0,
        minSellingPrice: Math.min(...sellingPrices),
        maxSellingPrice: Math.max(...sellingPrices),
        cost: floorCost,
        revenue: floorRevenue,
      });
      return;
    }

    const basePrice = getProductBasePrice(product);
    const sellingPrice = calculateSellingPrice(
      basePrice,
      getProductMarkup(product),
    );
    summary.cost += inventoryAmount * basePrice;
    summary.revenue += inventoryAmount * sellingPrice;
    summary.consideredProducts += 1;
  });

  summary.cost = roundBalance(summary.cost);
  summary.revenue = roundBalance(summary.revenue);
  summary.heightTierInsights = summary.heightTierInsights.map((item) => ({
    ...item,
    inventoryAmount: roundBalance(item.inventoryAmount),
    minSellingPrice: roundBalance(item.minSellingPrice),
    maxSellingPrice: roundBalance(item.maxSellingPrice),
    cost: roundBalance(item.cost),
    revenue: roundBalance(item.revenue),
  }));

  return summary;
}
