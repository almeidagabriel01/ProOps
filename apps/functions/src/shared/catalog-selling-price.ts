import {
  normalizeProductPricingModel,
  parsePricingNumber,
  roundPricingValue,
} from "./dimension-pricing";

/**
 * Preço de VENDA de um item do catálogo, como o seletor da OS mostra: o do
 * produto é custo mais markup (a primeira faixa, no produto por altura); o do
 * serviço é o preço dele.
 */
export function catalogSellingPrice(kind: "product" | "service", data: Record<string, unknown>): number {
  if (kind === "service") return roundPricingValue(Math.max(0, parsePricingNumber(data.price)));
  const model = normalizeProductPricingModel(data.pricingModel);
  if (model.mode === "curtain_height") {
    const tier = model.tiers[0];
    return tier ? roundPricingValue(tier.basePrice * (1 + tier.markup / 100)) : 0;
  }
  const base = Math.max(0, parsePricingNumber(data.price));
  const markup = Math.max(0, parsePricingNumber(data.markup));
  return roundPricingValue(base * (1 + markup / 100));
}

