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

export function summarizeCurtainInventoryBalance(
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
    const dimensionMultiplier = inventoryAmount > 0 ? inventoryAmount : 1;

    if (pricingMode === "standard") {
      if (inventoryAmount <= 0) {
        summary.skippedProducts += 1;
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
      return;
    }

    if (pricingMode === "curtain_height" && pricingModel.tiers.length > 0) {
      const representativeTier = getHeightTierById(product);
      const totalTierBasePrice = pricingModel.tiers.reduce(
        (sum, tier) => sum + tier.basePrice,
        0,
      );
      const totalTierSellingPrice = pricingModel.tiers.reduce(
        (sum, tier) =>
          sum + calculateSellingPrice(tier.basePrice, tier.markup),
        0,
      );
      const sellingPrices = pricingModel.tiers.map((tier) =>
        calculateSellingPrice(tier.basePrice, tier.markup),
      );

      summary.cost += dimensionMultiplier * totalTierBasePrice;
      summary.revenue += dimensionMultiplier * totalTierSellingPrice;
      summary.consideredProducts += 1;

      summary.heightTierInsights.push({
        productId: product.id,
        productName: product.name,
        inventoryAmount: dimensionMultiplier,
        representativeTier,
        tierCount: pricingModel.tiers.length,
        minHeight: pricingModel.tiers[0]?.maxHeight || 0,
        maxHeight:
          pricingModel.tiers[pricingModel.tiers.length - 1]?.maxHeight || 0,
        minSellingPrice: Math.min(...sellingPrices),
        maxSellingPrice: Math.max(...sellingPrices),
        cost: dimensionMultiplier * totalTierBasePrice,
        revenue: dimensionMultiplier * totalTierSellingPrice,
      });
      return;
    }

    const basePrice = getProductBasePrice(product);
    const sellingPrice = calculateSellingPrice(
      basePrice,
      getProductMarkup(product),
    );
    summary.cost += dimensionMultiplier * basePrice;
    summary.revenue += dimensionMultiplier * sellingPrice;
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
