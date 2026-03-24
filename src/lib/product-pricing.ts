"use client";

import type { TenantNiche } from "@/types";

export type ProductPricingMode =
  | "standard"
  | "curtain_meter"
  | "curtain_height";

export interface CurtainHeightTier {
  id: string;
  maxHeight: number;
  basePrice: number;
  markup: number;
}

export type ProductPricingModel =
  | {
      mode: "standard";
    }
  | {
      mode: "curtain_meter";
    }
  | {
      mode: "curtain_height";
      tiers: CurtainHeightTier[];
    };

export type ProposalProductPricingDetails =
  | {
      mode: "standard";
    }
  | {
      mode: "curtain_meter";
      width: number;
      height: number;
      area: number;
    }
  | {
      mode: "curtain_height";
      width: number;
      tierId: string;
      maxHeight: number;
    };

type ProductPricingSource = {
  price?: string | number | null;
  markup?: string | number | null;
  pricingModel?: ProductPricingModel | null;
};

type ProposalPricingSource = ProductPricingSource & {
  quantity?: number | null;
  unitPrice?: number | null;
  pricingDetails?: ProposalProductPricingDetails | null;
};

type HeightTierCandidate =
  | {
      id?: string | null;
      maxHeight?: string | number | null;
      basePrice?: string | number | null;
      markup?: string | number | null;
    }
  | null
  | undefined;

export function parsePricingNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const normalized = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(normalized) ? normalized : 0;
  }

  return 0;
}

export function roundPricingValue(value: number, decimals: number = 2): number {
  const factor = 10 ** decimals;
  return Math.round((Number.isFinite(value) ? value : 0) * factor) / factor;
}

export function sanitizeHeightTier(
  tier: HeightTierCandidate,
  index: number,
): CurtainHeightTier {
  return {
    id:
      typeof tier?.id === "string" && tier.id.trim()
        ? tier.id.trim()
        : `tier-${index + 1}`,
    maxHeight: roundPricingValue(Math.max(0, parsePricingNumber(tier?.maxHeight))),
    basePrice: roundPricingValue(Math.max(0, parsePricingNumber(tier?.basePrice))),
    markup: roundPricingValue(Math.max(0, parsePricingNumber(tier?.markup))),
  };
}

export function sanitizeHeightTiers(
  tiers: HeightTierCandidate[],
): CurtainHeightTier[] {
  return tiers
    .map((tier, index) => sanitizeHeightTier(tier, index))
    .filter((tier) => tier.maxHeight > 0 && tier.basePrice > 0)
    .sort((left, right) => left.maxHeight - right.maxHeight);
}

export function normalizeProductPricingModel(
  value: unknown,
): ProductPricingModel {
  if (!value || typeof value !== "object") {
    return { mode: "standard" };
  }

  const source = value as Record<string, unknown>;
  const mode = String(source.mode || "").trim();

  if (mode === "curtain_meter") {
    return { mode: "curtain_meter" };
  }

  if (mode === "curtain_height") {
    return {
      mode: "curtain_height",
      tiers: sanitizeHeightTiers(
        Array.isArray(source.tiers) ? (source.tiers as HeightTierCandidate[]) : [],
      ),
    };
  }

  return { mode: "standard" };
}

export function normalizeProposalPricingDetails(
  value: unknown,
): ProposalProductPricingDetails {
  if (!value || typeof value !== "object") {
    return { mode: "standard" };
  }

  const source = value as Record<string, unknown>;
  const mode = String(source.mode || "").trim();

  if (mode === "curtain_meter") {
    const width = roundPricingValue(Math.max(0, parsePricingNumber(source.width)));
    const height = roundPricingValue(
      Math.max(0, parsePricingNumber(source.height)),
    );

    return {
      mode: "curtain_meter",
      width,
      height,
      area: roundPricingValue(width * height, 4),
    };
  }

  if (mode === "curtain_height") {
    return {
      mode: "curtain_height",
      width: roundPricingValue(Math.max(0, parsePricingNumber(source.width))),
      tierId: typeof source.tierId === "string" ? source.tierId.trim() : "",
      maxHeight: roundPricingValue(
        Math.max(0, parsePricingNumber(source.maxHeight)),
      ),
    };
  }

  return { mode: "standard" };
}

export function getProductPricingMode(product: ProductPricingSource): ProductPricingMode {
  return normalizeProductPricingModel(product.pricingModel).mode;
}

export function isDimensionPricingMode(mode: ProductPricingMode): boolean {
  return mode === "curtain_meter" || mode === "curtain_height";
}

export function isDimensionPricedProduct(product: ProductPricingSource): boolean {
  return isDimensionPricingMode(getProductPricingMode(product));
}

export function getProductBasePrice(product: ProductPricingSource): number {
  const pricingModel = normalizeProductPricingModel(product.pricingModel);

  if (pricingModel.mode === "curtain_height") {
    const firstTier = pricingModel.tiers[0];
    return firstTier ? firstTier.basePrice : 0;
  }

  return Math.max(0, parsePricingNumber(product.price));
}

export function getProductMarkup(product: ProductPricingSource): number {
  const pricingModel = normalizeProductPricingModel(product.pricingModel);

  if (pricingModel.mode === "curtain_height") {
    const firstTier = pricingModel.tiers[0];
    return firstTier ? firstTier.markup : 0;
  }

  return Math.max(0, parsePricingNumber(product.markup));
}

export function calculateSellingPrice(basePrice: number, markup: number): number {
  return roundPricingValue(basePrice * (1 + markup / 100));
}

export function getHeightTierById(
  product: ProductPricingSource,
  tierId?: string | null,
): CurtainHeightTier | null {
  const pricingModel = normalizeProductPricingModel(product.pricingModel);
  if (pricingModel.mode !== "curtain_height") {
    return null;
  }

  if (tierId) {
    const tier = pricingModel.tiers.find((item) => item.id === tierId);
    if (tier) return tier;
  }

  return pricingModel.tiers[0] || null;
}

export function createDefaultProposalPricingDetails(
  product: ProductPricingSource,
): ProposalProductPricingDetails {
  const pricingModel = normalizeProductPricingModel(product.pricingModel);

  if (pricingModel.mode === "curtain_meter") {
    return {
      mode: "curtain_meter",
      width: 0,
      height: 0,
      area: 0,
    };
  }

  if (pricingModel.mode === "curtain_height") {
    const firstTier = pricingModel.tiers[0];
    return {
      mode: "curtain_height",
      width: 0,
      tierId: firstTier?.id || "",
      maxHeight: firstTier?.maxHeight || 0,
    };
  }

  return { mode: "standard" };
}

export function calculateProposalProductPricing(
  source: ProposalPricingSource,
): {
  pricingDetails: ProposalProductPricingDetails;
  quantity: number;
  unitPrice: number;
  markup: number;
  total: number;
  sellingPrice: number;
} {
  const pricingModel = normalizeProductPricingModel(source.pricingModel);
  const fallbackUnitPrice = Math.max(0, Number(source.unitPrice || 0));
  const fallbackMarkup = Math.max(0, parsePricingNumber(source.markup));
  const fallbackQuantity = roundPricingValue(
    Math.max(0, Number(source.quantity || 0)),
    4,
  );

  if (pricingModel.mode === "curtain_meter") {
    const details = normalizeProposalPricingDetails(
      source.pricingDetails || createDefaultProposalPricingDetails(source),
    );
    const width = details.mode === "curtain_meter" ? details.width : 0;
    const height = details.mode === "curtain_meter" ? details.height : 0;
    const area = roundPricingValue(width * height, 4);
    const unitPrice = getProductBasePrice(source);
    const markup = getProductMarkup(source);
    const sellingPrice = calculateSellingPrice(unitPrice, markup);
    const total = roundPricingValue(area * sellingPrice);

    return {
      pricingDetails: {
        mode: "curtain_meter",
        width,
        height,
        area,
      },
      quantity: area,
      unitPrice,
      markup,
      total,
      sellingPrice,
    };
  }

  if (pricingModel.mode === "curtain_height") {
    const normalizedDetails = normalizeProposalPricingDetails(
      source.pricingDetails || createDefaultProposalPricingDetails(source),
    );
    const selectedTier = getHeightTierById(
      source,
      normalizedDetails.mode === "curtain_height"
        ? normalizedDetails.tierId
        : undefined,
    );
    const width =
      normalizedDetails.mode === "curtain_height" ? normalizedDetails.width : 0;
    const unitPrice = selectedTier?.basePrice || 0;
    const markup = selectedTier?.markup || 0;
    const sellingPrice = calculateSellingPrice(unitPrice, markup);
    const total = roundPricingValue(width * sellingPrice);

    return {
      pricingDetails: {
        mode: "curtain_height",
        width,
        tierId: selectedTier?.id || "",
        maxHeight: selectedTier?.maxHeight || 0,
      },
      quantity: width,
      unitPrice,
      markup,
      total,
      sellingPrice,
    };
  }

  const unitPrice = fallbackUnitPrice || getProductBasePrice(source);
  const markup = fallbackMarkup;
  const sellingPrice = calculateSellingPrice(unitPrice, markup);
  const total = roundPricingValue(fallbackQuantity * sellingPrice);

  return {
    pricingDetails: { mode: "standard" },
    quantity: fallbackQuantity,
    unitPrice,
    markup,
    total,
    sellingPrice,
  };
}

export function formatMeters(value: number): string {
  return `${roundPricingValue(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} m`;
}

export function getProductPricingSummary(product: ProductPricingSource): string {
  const pricingModel = normalizeProductPricingModel(product.pricingModel);

  if (pricingModel.mode === "curtain_meter") {
    const sellingPrice = calculateSellingPrice(
      getProductBasePrice(product),
      getProductMarkup(product),
    );
    return `R$ ${sellingPrice.toFixed(2)} / m²`;
  }

  if (pricingModel.mode === "curtain_height") {
    const firstTier = pricingModel.tiers[0];
    const lastTier = pricingModel.tiers[pricingModel.tiers.length - 1];
    if (!firstTier) {
      return "Faixas de altura";
    }

    const firstPrice = calculateSellingPrice(firstTier.basePrice, firstTier.markup);
    const lastPrice = calculateSellingPrice(
      (lastTier || firstTier).basePrice,
      (lastTier || firstTier).markup,
    );

    if (firstTier.id === lastTier?.id) {
      return `R$ ${firstPrice.toFixed(2)} / m larg.`;
    }

    return `R$ ${firstPrice.toFixed(2)} a R$ ${lastPrice.toFixed(2)} / m larg.`;
  }

  const sellingPrice = calculateSellingPrice(
    getProductBasePrice(product),
    getProductMarkup(product),
  );
  return `R$ ${sellingPrice.toFixed(2)}`;
}

export function getProductPricingDescription(product: ProductPricingSource): string {
  const pricingModel = normalizeProductPricingModel(product.pricingModel);

  if (pricingModel.mode === "curtain_meter") {
    return "Calculado por largura x altura x preço com markup.";
  }

  if (pricingModel.mode === "curtain_height") {
    if (pricingModel.tiers.length === 0) {
      return "Faixas de altura sem configuração.";
    }

    return pricingModel.tiers
      .map((tier, index) => {
        const startLabel =
          index === 0
            ? `até ${formatMeters(tier.maxHeight)}`
            : `até ${formatMeters(tier.maxHeight)}`;
        return `${startLabel}: R$ ${calculateSellingPrice(
          tier.basePrice,
          tier.markup,
        ).toFixed(2)} / m larg.`;
      })
      .join(" | ");
  }

  return "Preço simples por quantidade.";
}

export function getProposalProductMeasurementLabel(
  product: Pick<ProposalPricingSource, "pricingDetails" | "quantity">,
): string {
  const details = normalizeProposalPricingDetails(product.pricingDetails);

  if (details.mode === "curtain_meter") {
    return `${formatMeters(details.width)} x ${formatMeters(details.height)}`;
  }

  if (details.mode === "curtain_height") {
    return `Largura ${formatMeters(details.width)} | Altura até ${formatMeters(
      details.maxHeight,
    )}`;
  }

  const quantity = roundPricingValue(Math.max(0, Number(product.quantity || 0)), 4);
  return `Qtd. ${quantity.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: quantity % 1 === 0 ? 0 : 2,
  })}`;
}

export function getProposalProductUnitLabel(
  product: Pick<ProposalPricingSource, "pricingDetails">,
): string {
  const details = normalizeProposalPricingDetails(product.pricingDetails);

  if (details.mode === "curtain_meter") {
    return "m²";
  }

  if (details.mode === "curtain_height") {
    return "m larg.";
  }

  return "un";
}

export function isCortinasNiche(
  tenantNiche: TenantNiche | null | undefined,
): boolean {
  return tenantNiche === "cortinas";
}

/**
 * Cortinas PDF/UI: produto com preço por dimensão (medida em vez de "Nx").
 */
export function isCortinasDimensionProductLine(
  tenantNiche: TenantNiche | null | undefined,
  product: {
    itemType?: "product" | "service";
    pricingDetails?: ProposalProductPricingDetails | null;
  },
): boolean {
  if (!isCortinasNiche(tenantNiche)) return false;
  if (product.itemType === "service") return false;
  const mode = normalizeProposalPricingDetails(product.pricingDetails).mode;
  return isDimensionPricingMode(mode);
}

/**
 * Cortinas: serviço — linha sem prefixo "Nx", só valor unitário neutro.
 */
export function isCortinasNeutralServiceLine(
  tenantNiche: TenantNiche | null | undefined,
  product: { itemType?: "product" | "service" },
): boolean {
  return isCortinasNiche(tenantNiche) && product.itemType === "service";
}

/** Preço de venda por unidade (produto com markup; serviço = unitPrice). */
export function getProposalLineUnitSellingPrice(product: {
  itemType?: "product" | "service";
  unitPrice?: number | null;
  markup?: number | null;
}): number {
  const unit = Number(product.unitPrice || 0);
  if (product.itemType === "service") return unit;
  return unit * (1 + (Number(product.markup || 0) / 100));
}
