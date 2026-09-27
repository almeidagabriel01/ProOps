/**
 * Linha de proposta montada pela Lia a partir do produto do catálogo.
 *
 * Até 2026-09 a Lia gravava a linha num formato próprio (`name`, `price`,
 * `subtotal`) que a tela não lê, com o preço de CUSTO (sem markup) e sem as
 * medidas do produto cobrado por medida: a proposta abria sem nome e sem valor
 * nas linhas, e o total era o de custo. Agora o preço sai do mesmo cálculo da
 * tela (`shared/dimension-pricing.ts`, com teste de paridade) e a linha tem o
 * formato do formulário.
 */
import {
  calculateProposalProductPricing,
  normalizeProductPricingModel,
  type ProductPricingModel,
  type ProposalProductPricingDetails,
} from "../../shared/dimension-pricing";

export interface CatalogProductForLia {
  name: string;
  price?: unknown;
  markup?: unknown;
  pricingModel?: unknown;
}

export interface LiaProposalItemInput {
  productId: string;
  quantity?: number;
  /** Metros. */
  width?: number;
  /** Metros. Por área, é a altura do vão; por faixa, escolhe a faixa. */
  height?: number;
  panels?: number;
  description?: string;
}

export interface LiaProposalLine {
  productId: string;
  productName: string;
  productDescription: string;
  quantity: number;
  unitPrice: number;
  markup: number;
  total: number;
  pricingDetails: ProposalProductPricingDetails;
}

function positive(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function detailsFor(
  model: ProductPricingModel,
  item: LiaProposalItemInput,
  productName: string,
): ProposalProductPricingDetails | undefined {
  if (model.mode === "standard") return undefined;

  const width = positive(item.width);
  const panels = positive(item.panels) ?? 1;

  if (model.mode === "curtain_meter") {
    const height = positive(item.height);
    if (!width || !height) {
      throw new Error(
        `"${productName}" é cobrado por área: informe a largura e a altura em metros.`,
      );
    }
    return { mode: "curtain_meter", width, height, area: 0, panels };
  }

  if (!width) {
    throw new Error(`"${productName}" é cobrado por medida: informe a largura em metros.`);
  }

  if (model.mode === "curtain_width") {
    return { mode: "curtain_width", width, panels };
  }

  // Faixa de altura: a menor faixa que comporta a altura pedida.
  const height = positive(item.height);
  if (!height) {
    throw new Error(
      `"${productName}" é cobrado por faixa de altura: informe a altura e a largura em metros.`,
    );
  }
  const tier = model.tiers.find((candidate) => candidate.maxHeight >= height);
  if (!tier) {
    const tallest = model.tiers[model.tiers.length - 1]?.maxHeight ?? 0;
    throw new Error(
      `"${productName}" vai até ${tallest.toLocaleString("pt-BR")} m de altura; ${height.toLocaleString("pt-BR")} m não cabe em nenhuma faixa.`,
    );
  }
  return { mode: "curtain_height", width, tierId: tier.id, maxHeight: tier.maxHeight, panels };
}

export function buildLiaProposalLine(
  product: CatalogProductForLia,
  item: LiaProposalItemInput,
): LiaProposalLine {
  const model = normalizeProductPricingModel(product.pricingModel);
  const pricingDetails = detailsFor(model, item, product.name);

  if (model.mode === "standard" && !positive(item.quantity)) {
    throw new Error(`Informe a quantidade de "${product.name}".`);
  }

  const pricing = calculateProposalProductPricing({
    price: product.price as string | number | null | undefined,
    markup: product.markup as string | number | null | undefined,
    pricingModel: model,
    quantity: item.quantity,
    pricingDetails,
  });

  return {
    productId: item.productId,
    productName: product.name,
    productDescription: item.description ?? "",
    quantity: pricing.quantity,
    unitPrice: pricing.unitPrice,
    markup: pricing.markup,
    total: pricing.total,
    pricingDetails: pricing.pricingDetails,
  };
}
