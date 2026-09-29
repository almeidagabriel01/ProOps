import { describe, expect, it } from "vitest";
import {
  calculateProposalProductPricing,
  getChargeableQuantityFromPricingDetails,
  getProductPricingSummary,
  getProposalProductMeasurementLabel,
  getProposalProductPanelCount,
  getProposalProductUnitLabel,
  hydrateProposalPricingDetails,
  normalizeProductPricingModel,
} from "@/lib/product-pricing";

/**
 * O motor de preço por medida (m², largura e faixa de altura) calcula o valor
 * que vai para a proposta, o PDF e a nota fiscal, e não tinha teste nenhum.
 * Os ids `curtain_*` são históricos e ficam gravados em produtos e propostas.
 */

const tiers = [
  { id: "t2", maxHeight: 2.8, basePrice: 120, markup: 50 },
  { id: "t1", maxHeight: 2.2, basePrice: 100, markup: 50 },
];

describe("calculateProposalProductPricing", () => {
  it("padrão: quantidade × preço com markup", () => {
    const result = calculateProposalProductPricing({ price: 100, markup: 20, quantity: 3 });
    expect(result).toMatchObject({ quantity: 3, unitPrice: 100, markup: 20, sellingPrice: 120, total: 360 });
    expect(result.pricingDetails).toEqual({ mode: "standard" });
  });

  it("por área: largura × altura × painéis × preço de venda", () => {
    const result = calculateProposalProductPricing({
      price: 100,
      markup: 50,
      pricingModel: { mode: "curtain_meter" },
      pricingDetails: { mode: "curtain_meter", width: 1.2, height: 2.5, area: 0, panels: 2 },
    });
    expect(result.pricingDetails).toEqual({ mode: "curtain_meter", width: 1.2, height: 2.5, area: 3, panels: 2 });
    expect(result).toMatchObject({ quantity: 6, sellingPrice: 150, total: 900 });
  });

  it("por largura: largura × painéis × preço de venda", () => {
    const result = calculateProposalProductPricing({
      price: 80,
      markup: 25,
      pricingModel: { mode: "curtain_width" },
      pricingDetails: { mode: "curtain_width", width: 3, panels: 2 },
    });
    expect(result).toMatchObject({ quantity: 6, sellingPrice: 100, total: 600 });
  });

  it("por faixa de altura: usa o preço da faixa escolhida (faixas ordenadas por altura)", () => {
    const pricingModel = normalizeProductPricingModel({ mode: "curtain_height", tiers });
    expect(pricingModel).toEqual({ mode: "curtain_height", tiers: [tiers[1], tiers[0]] });

    const result = calculateProposalProductPricing({
      pricingModel,
      pricingDetails: { mode: "curtain_height", width: 2, tierId: "t2", maxHeight: 0, panels: 1 },
    });
    expect(result.pricingDetails).toEqual({ mode: "curtain_height", width: 2, tierId: "t2", maxHeight: 2.8, panels: 1 });
    expect(result).toMatchObject({ quantity: 2, unitPrice: 120, sellingPrice: 180, total: 360 });
  });

  it("faixa inexistente cai na primeira (a mais baixa)", () => {
    const result = calculateProposalProductPricing({
      pricingModel: { mode: "curtain_height", tiers },
      pricingDetails: { mode: "curtain_height", width: 1, tierId: "nao-existe", maxHeight: 0, panels: 1 },
    });
    expect(result).toMatchObject({ unitPrice: 100, total: 150 });
  });

  it("sem medidas, o produto por medida nasce com zero e um painel", () => {
    const result = calculateProposalProductPricing({ price: 100, pricingModel: { mode: "curtain_meter" } });
    expect(result.pricingDetails).toEqual({ mode: "curtain_meter", width: 0, height: 0, area: 0, panels: 1 });
    expect(result.total).toBe(0);
  });
});

describe("quantidade cobrada e painéis", () => {
  it("quantidade cobrada por modo", () => {
    expect(getChargeableQuantityFromPricingDetails({ mode: "curtain_meter", width: 2, height: 2, area: 4, panels: 3 })).toBe(12);
    expect(getChargeableQuantityFromPricingDetails({ mode: "curtain_width", width: 2.5, panels: 2 })).toBe(5);
    expect(getChargeableQuantityFromPricingDetails({ mode: "standard" }, 7)).toBe(7);
  });

  it("painéis explícitos valem mesmo com quantidade divergente", () => {
    const details = hydrateProposalPricingDetails({
      quantity: 99,
      pricingDetails: { mode: "curtain_width", width: 2, panels: 3 },
    });
    expect(details).toEqual({ mode: "curtain_width", width: 2, panels: 3 });
  });

  it("sem painéis gravados, deduz pela quantidade", () => {
    const details = hydrateProposalPricingDetails({
      quantity: 6,
      pricingDetails: { mode: "curtain_width", width: 2 } as never,
    });
    expect(details).toEqual({ mode: "curtain_width", width: 2, panels: 3 });
  });

  it("produto padrão não tem contagem de painéis", () => {
    expect(getProposalProductPanelCount({ quantity: 2, pricingDetails: { mode: "standard" } })).toBeNull();
  });
});

describe("rótulos", () => {
  it("resumo de preço do catálogo", () => {
    expect(getProductPricingSummary({ price: 100, markup: 0 })).toBe("R$ 100.00");
    expect(getProductPricingSummary({ price: 100, markup: 0, pricingModel: { mode: "curtain_width" } })).toBe("R$ 100.00 / m larg.");
    expect(getProductPricingSummary({ pricingModel: { mode: "curtain_height", tiers } })).toBe("R$ 150.00 a R$ 180.00 / m larg.");
  });

  it("medida mostrada na proposta", () => {
    expect(
      getProposalProductMeasurementLabel({ pricingDetails: { mode: "curtain_meter", width: 1.2, height: 2.5, area: 3, panels: 1 } }),
    ).toBe("1,2 m x 2,5 m");
    expect(getProposalProductMeasurementLabel({ pricingDetails: { mode: "curtain_width", width: 3, panels: 1 } })).toBe("Largura 3 m");
    // O nome da medida vem do nicho: a tubulação de climatização se mede em
    // comprimento, e a proposta e o PDF diziam "Largura" para um cano.
    const comprimento = { measureLabels: { curtain_width: { width: { singular: "comprimento", plural: "comprimentos", gender: "m" as const } } } };
    expect(getProposalProductMeasurementLabel({ pricingDetails: { mode: "curtain_width", width: 6, panels: 1 } }, comprimento)).toBe("Comprimento 6 m");
    expect(getProposalProductMeasurementLabel({ pricingDetails: { mode: "curtain_width", width: 6, panels: 1 } }, {})).toBe("Largura 6 m");
    expect(getProposalProductMeasurementLabel({ quantity: 2, pricingDetails: { mode: "standard" } })).toBe("Qtd. 2");
  });

  it("texto que vai para o PDF do cliente sai acentuado", () => {
    expect(getProductPricingSummary({ price: 100, markup: 0, pricingModel: { mode: "curtain_meter" } })).toBe("R$ 100.00 / m²");
    expect(
      getProposalProductMeasurementLabel({
        pricingDetails: { mode: "curtain_height", width: 2, tierId: "t1", maxHeight: 2.8, panels: 1 },
      }),
    ).toBe("Largura 2 m | Altura até 2,8 m");
    expect(
      getProposalProductUnitLabel({ pricingDetails: { mode: "curtain_meter", width: 1, height: 1, area: 1, panels: 1 } }),
    ).toBe("m²");
  });

  it("unidade da linha", () => {
    expect(getProposalProductUnitLabel({ pricingDetails: { mode: "curtain_width", width: 1, panels: 1 } })).toBe("m larg.");
    expect(getProposalProductUnitLabel({ pricingDetails: { mode: "standard" } })).toBe("un");
  });
});
