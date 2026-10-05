import {
  calculateSellingPrice,
  getProductBasePrice,
  getProductMarkup,
  normalizeProductPricingModel,
  parsePricingNumber,
  roundPricingValue,
  type CurtainHeightTier,
  type ProductPricingModel,
} from "@/lib/product-pricing";

/**
 * Tabela de preço aplicada a um item do catálogo. Módulo puro, sem React nem
 * Firebase: é o que o formulário de proposta chama para precificar a linha
 * quando o cliente tem uma tabela específica.
 *
 * A tabela PADRÃO é o próprio catálogo (sem tabela: `null`). Uma tabela
 * específica tem duas formas, que convivem:
 *
 * - `adjustmentPercent`: ajuste sobre o PREÇO DE VENDA padrão
 *   (custo × (1 + markup/100)), negativo = desconto, positivo = acréscimo;
 * - `productPrices` / `servicePrices`: preço de venda próprio do item, na
 *   unidade de medida dele (unidade, m², m linear). Vence o percentual.
 *
 * O custo do produto NUNCA muda: quem muda é o markup, recalculado para que
 * custo × (1 + markup/100), arredondado a centavo, dê o preço da tabela. Assim
 * o lucro da proposta continua certo.
 *
 * Produto por faixa de altura não tem preço próprio (o preço depende da
 * faixa): nele vale só o percentual, aplicado a cada faixa (`heightTiers`).
 */

export interface PriceTableRules {
  adjustmentPercent: number;
  productPrices?: Record<string, number>;
  servicePrices?: Record<string, number>;
}

export interface PriceTable extends PriceTableRules {
  id: string;
  name: string;
  productPrices: Record<string, number>;
  servicePrices: Record<string, number>;
  createdAt?: string;
  updatedAt?: string;
}

/** De onde veio o preço: o catálogo, o percentual da tabela ou o preço próprio do item. */
export type PriceTableSource = "catalog" | "percent" | "specific";

export interface PricedCatalogProduct {
  id: string;
  price?: string | number | null;
  markup?: string | number | null;
  pricingModel?: ProductPricingModel | null;
}

export interface PriceTableProductPrice {
  /** Preço de venda por unidade de medida, com a tabela aplicada, em centavos. */
  sellingPrice: number;
  /**
   * Markup que a linha da proposta deve gravar para que
   * custo × (1 + markup/100) = `sellingPrice`. `null` quando o custo é zero:
   * nenhum markup leva zero a um preço (ver `markupApplies`).
   */
  markup: number | null;
  /**
   * `false` só quando a tabela mudou o preço de um produto de custo zero. Aí
   * a linha precisa receber `sellingPrice` como preço unitário e markup 0, e o
   * lucro dela aparece como zero (o catálogo não informa o custo).
   */
  markupApplies: boolean;
  /** Preço da tabela abaixo do custo (markup negativo). */
  belowCost: boolean;
  source: PriceTableSource;
  /** Só no produto por faixa de altura: as faixas com o percentual aplicado. */
  heightTiers?: CurtainHeightTier[];
}

export interface PriceTableServicePrice {
  sellingPrice: number;
  source: PriceTableSource;
}

/** Preço com o percentual da tabela, em centavos e nunca negativo. */
export function applyPriceTableAdjustment(price: number, adjustmentPercent: number): number {
  const percent = Number.isFinite(adjustmentPercent) ? adjustmentPercent : 0;
  return Math.max(0, roundPricingValue(price * (1 + percent / 100)));
}

/**
 * Markup que leva `cost` a `sellingPrice` pelo mesmo arredondamento do
 * catálogo (`calculateSellingPrice`). Usa o menor número de casas que acerta
 * o centavo (10% de desconto sobre 50% de markup dá 35, não 34,999999), e cai
 * no valor exato quando nenhum arredondamento acerta. `null` com custo zero.
 */
export function deriveMarkupForPrice(cost: number, sellingPrice: number): number | null {
  if (!(cost > 0)) return null;
  const exact = (sellingPrice / cost - 1) * 100;
  for (let decimals = 2; decimals <= 10; decimals += 1) {
    const candidate = roundPricingValue(exact, decimals);
    if (calculateSellingPrice(cost, candidate) === sellingPrice) return candidate;
  }
  return exact;
}

function specificPrice(map: Record<string, number> | undefined, id: string): number | null {
  const value = map?.[id];
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? roundPricingValue(value)
    : null;
}

function hasAdjustment(table: PriceTableRules): boolean {
  return Number.isFinite(table.adjustmentPercent) && table.adjustmentPercent !== 0;
}

export function resolveProductTablePrice(
  product: PricedCatalogProduct,
  table: PriceTableRules | null | undefined,
): PriceTableProductPrice {
  const cost = getProductBasePrice(product);
  const catalogMarkup = getProductMarkup(product);
  const catalogPrice = calculateSellingPrice(cost, catalogMarkup);
  const pricingModel = normalizeProductPricingModel(product.pricingModel);

  const catalog: PriceTableProductPrice = {
    sellingPrice: catalogPrice,
    markup: catalogMarkup,
    markupApplies: true,
    belowCost: false,
    source: "catalog",
    ...(pricingModel.mode === "curtain_height" ? { heightTiers: pricingModel.tiers } : {}),
  };
  if (!table) return catalog;

  if (pricingModel.mode === "curtain_height") {
    if (!hasAdjustment(table) || pricingModel.tiers.length === 0) return catalog;
    const heightTiers = pricingModel.tiers.map((tier) => {
      const tierPrice = applyPriceTableAdjustment(
        calculateSellingPrice(tier.basePrice, tier.markup),
        table.adjustmentPercent,
      );
      return { ...tier, markup: deriveMarkupForPrice(tier.basePrice, tierPrice) ?? tier.markup };
    });
    const first = heightTiers[0];
    const sellingPrice = calculateSellingPrice(first.basePrice, first.markup);
    return {
      sellingPrice,
      markup: first.markup,
      markupApplies: true,
      belowCost: first.markup < 0,
      source: "percent",
      heightTiers,
    };
  }

  const specific = specificPrice(table.productPrices, product.id);
  let sellingPrice: number;
  let source: PriceTableSource;
  if (specific !== null) {
    sellingPrice = specific;
    source = "specific";
  } else if (hasAdjustment(table)) {
    sellingPrice = applyPriceTableAdjustment(catalogPrice, table.adjustmentPercent);
    source = "percent";
  } else {
    return catalog;
  }

  const markup = deriveMarkupForPrice(cost, sellingPrice);
  return {
    sellingPrice,
    markup,
    markupApplies: markup !== null || sellingPrice === catalogPrice,
    belowCost: cost > 0 && sellingPrice < cost,
    source,
  };
}

/** O serviço do catálogo só tem preço (sem custo nem markup): a tabela muda o preço direto. */
export function resolveServiceTablePrice(
  service: { id: string; price?: string | number | null },
  table: PriceTableRules | null | undefined,
): PriceTableServicePrice {
  const catalogPrice = roundPricingValue(Math.max(0, parsePricingNumber(service.price)));
  if (!table) return { sellingPrice: catalogPrice, source: "catalog" };
  const specific = specificPrice(table.servicePrices, service.id);
  if (specific !== null) return { sellingPrice: specific, source: "specific" };
  if (hasAdjustment(table)) {
    return {
      sellingPrice: applyPriceTableAdjustment(catalogPrice, table.adjustmentPercent),
      source: "percent",
    };
  }
  return { sellingPrice: catalogPrice, source: "catalog" };
}

/** Produto que aceita preço próprio na tabela: todos menos o por faixa de altura. */
export function acceptsSpecificPrice(product: PricedCatalogProduct): boolean {
  return normalizeProductPricingModel(product.pricingModel).mode !== "curtain_height";
}

const percentFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

/** "10% de desconto", "5,5% de acréscimo" ou "Sem ajuste". */
export function describePriceTableAdjustment(adjustmentPercent: number): string {
  if (!Number.isFinite(adjustmentPercent) || adjustmentPercent === 0) return "Sem ajuste";
  const amount = percentFormatter.format(Math.abs(adjustmentPercent));
  return adjustmentPercent < 0 ? `${amount}% de desconto` : `${amount}% de acréscimo`;
}
