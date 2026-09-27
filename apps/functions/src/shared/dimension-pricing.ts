/**
 * Cálculo do preço de uma linha de proposta: espelho do backend de
 * `apps/web/src/lib/product-pricing.ts` (da definição dos modos até
 * `calculateProposalProductPricing`). A Lia monta proposta no servidor e
 * precisa chegar no MESMO total que a tela; a paridade é garantida por
 * `apps/web/src/__tests__/dimension-pricing-parity.test.ts`.
 *
 * Os ids `curtain_*` são históricos e ficam gravados em produtos e propostas:
 * `curtain_meter` cobra por área (m²), `curtain_width` por largura e
 * `curtain_height` por largura na faixa de altura escolhida.
 */

export type ProductPricingMode =
  | "standard"
  | "curtain_meter"
  | "curtain_height"
  | "curtain_width";

/** Modos de preço por medida. `curtain_meter` é histórico: cobra por ÁREA (m²). */
export type DimensionPricingMode = Exclude<ProductPricingMode, "standard">;

export interface CurtainHeightTier {
  id: string;
  maxHeight: number;
  basePrice: number;
  markup: number;
}

const DEFAULT_CURTAIN_PANELS = 1;

export type ProductPricingModel =
  | {
      mode: "standard";
    }
  | {
      mode: "curtain_meter";
    }
  | {
      mode: "curtain_width";
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
      panels: number;
    }
  | {
      mode: "curtain_width";
      width: number;
      panels: number;
    }
  | {
      mode: "curtain_height";
      width: number;
      tierId: string;
      maxHeight: number;
      panels: number;
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

export function normalizeCurtainPanels(value: unknown): number {
  const parsed = Math.trunc(parsePricingNumber(value));
  return parsed >= 1 ? parsed : DEFAULT_CURTAIN_PANELS;
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

  if (mode === "curtain_width") {
    return { mode: "curtain_width" };
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
      panels: normalizeCurtainPanels(source.panels),
    };
  }

  if (mode === "curtain_width") {
    return {
      mode: "curtain_width",
      width: roundPricingValue(Math.max(0, parsePricingNumber(source.width))),
      panels: normalizeCurtainPanels(source.panels),
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
      panels: normalizeCurtainPanels(source.panels),
    };
  }

  return { mode: "standard" };
}

export function getProductPricingMode(product: ProductPricingSource): ProductPricingMode {
  return normalizeProductPricingModel(product.pricingModel).mode;
}

export function isDimensionPricingMode(mode: ProductPricingMode): boolean {
  return (
    mode === "curtain_meter" ||
    mode === "curtain_height" ||
    mode === "curtain_width"
  );
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
      panels: DEFAULT_CURTAIN_PANELS,
    };
  }

  if (pricingModel.mode === "curtain_width") {
    return {
      mode: "curtain_width",
      width: 0,
      panels: DEFAULT_CURTAIN_PANELS,
    };
  }

  if (pricingModel.mode === "curtain_height") {
    const firstTier = pricingModel.tiers[0];
    return {
      mode: "curtain_height",
      width: 0,
      tierId: firstTier?.id || "",
      maxHeight: firstTier?.maxHeight || 0,
      panels: DEFAULT_CURTAIN_PANELS,
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
    const panels = details.mode === "curtain_meter" ? details.panels : 1;
    const area = roundPricingValue(width * height, 4);
    const totalArea = roundPricingValue(area * panels, 4);
    const unitPrice = getProductBasePrice(source);
    const markup = getProductMarkup(source);
    const sellingPrice = calculateSellingPrice(unitPrice, markup);
    const total = roundPricingValue(totalArea * sellingPrice);

    return {
      pricingDetails: {
        mode: "curtain_meter",
        width,
        height,
        area,
        panels,
      },
      quantity: totalArea,
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
    const panels =
      normalizedDetails.mode === "curtain_height"
        ? normalizedDetails.panels
        : DEFAULT_CURTAIN_PANELS;
    const totalWidth = roundPricingValue(width * panels, 4);
    const unitPrice = selectedTier?.basePrice || 0;
    const markup = selectedTier?.markup || 0;
    const sellingPrice = calculateSellingPrice(unitPrice, markup);
    const total = roundPricingValue(totalWidth * sellingPrice);

    return {
      pricingDetails: {
        mode: "curtain_height",
        width,
        tierId: selectedTier?.id || "",
        maxHeight: selectedTier?.maxHeight || 0,
        panels,
      },
      quantity: totalWidth,
      unitPrice,
      markup,
      total,
      sellingPrice,
    };
  }

  if (pricingModel.mode === "curtain_width") {
    const details = normalizeProposalPricingDetails(
      source.pricingDetails || createDefaultProposalPricingDetails(source),
    );
    const width = details.mode === "curtain_width" ? details.width : 0;
    const panels =
      details.mode === "curtain_width" ? details.panels : DEFAULT_CURTAIN_PANELS;
    const totalWidth = roundPricingValue(width * panels, 4);
    const unitPrice = getProductBasePrice(source);
    const markup = getProductMarkup(source);
    const sellingPrice = calculateSellingPrice(unitPrice, markup);
    const total = roundPricingValue(totalWidth * sellingPrice);

    return {
      pricingDetails: {
        mode: "curtain_width",
        width,
        panels,
      },
      quantity: totalWidth,
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
