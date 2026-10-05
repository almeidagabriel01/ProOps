import { describe, expect, it } from "vitest";
import { applyPriceTableToCatalog, type PriceTableRules } from "../price-table";
import { buildProposalProductFromCatalog } from "@/lib/proposal-product";
import { proposalLinesProfit } from "@/lib/proposal/profit";
import type { Product } from "@/services/product-service";
import type { Service } from "@/services/service-service";

/**
 * O formulário de proposta usa o catálogo com a tabela do cliente aplicada:
 * a linha nova já nasce com o preço da tabela, o custo continua o real e o
 * lucro sai certo.
 */

const amplificador = {
  id: "amp",
  name: "Amplificador",
  itemType: "product",
  price: "100",
  markup: "50",
  manufacturer: "",
} as unknown as Product;
const semCusto = {
  id: "brinde",
  name: "Brinde",
  itemType: "product",
  price: "0",
  markup: "0",
} as unknown as Product;
const instalacao = {
  id: "inst",
  name: "Instalação",
  itemType: "service",
  price: "500",
} as unknown as Service;
const persiana = {
  id: "per",
  name: "Persiana",
  itemType: "product",
  price: "0",
  pricingModel: {
    mode: "curtain_height",
    tiers: [{ id: "t1", maxHeight: 2.5, basePrice: 100, markup: 50 }],
  },
} as unknown as Product;

const dezPorCentoMenos: PriceTableRules = { adjustmentPercent: -10 };

describe("applyPriceTableToCatalog", () => {
  it("sem tabela, o catálogo é o mesmo", () => {
    const catalog = [amplificador, instalacao];
    expect(applyPriceTableToCatalog(catalog, null)).toBe(catalog);
  });

  it("percentual: o produto ganha o markup que dá o preço da tabela, com o custo intacto", () => {
    const [priced] = applyPriceTableToCatalog([amplificador], dezPorCentoMenos);
    expect(priced.price).toBe("100");
    // 150 com 10% de desconto = 135
    expect(priced.markup).toBe("35");
  });

  it("a linha da proposta nasce no preço da tabela e o lucro continua certo", () => {
    const [priced] = applyPriceTableToCatalog([amplificador], dezPorCentoMenos);
    const line = buildProposalProductFromCatalog(priced, { quantity: 2 });
    expect(line.unitPrice).toBe(100);
    expect(line.total).toBe(270);
    expect(proposalLinesProfit([line])).toBe(70);
  });

  it("preço próprio vence o percentual", () => {
    const table: PriceTableRules = { adjustmentPercent: -10, productPrices: { amp: 120 } };
    const [priced] = applyPriceTableToCatalog([amplificador], table);
    expect(buildProposalProductFromCatalog(priced).total).toBe(120);
  });

  it("serviço: a tabela muda o preço direto", () => {
    const [percent] = applyPriceTableToCatalog([instalacao], dezPorCentoMenos);
    expect(percent.price).toBe("450");
    const [specific] = applyPriceTableToCatalog([instalacao], {
      adjustmentPercent: 0,
      servicePrices: { inst: 400 },
    });
    expect(specific.price).toBe("400");
  });

  it("produto sem custo recebe o preço da tabela como preço, com markup 0", () => {
    const [priced] = applyPriceTableToCatalog([semCusto], {
      adjustmentPercent: 0,
      productPrices: { brinde: 30 },
    });
    expect(priced).toMatchObject({ price: "30", markup: "0" });
  });

  it("abaixo do custo a linha fica no custo", () => {
    const [priced] = applyPriceTableToCatalog([amplificador], { adjustmentPercent: -50 });
    expect(priced.markup).toBe("0");
  });

  it("persiana por faixa de altura: o percentual vai para cada faixa", () => {
    const [priced] = applyPriceTableToCatalog([persiana], dezPorCentoMenos);
    expect(priced.pricingModel).toMatchObject({
      mode: "curtain_height",
      tiers: [{ id: "t1", basePrice: 100, markup: 35 }],
    });
  });

  it("item que a tabela não toca continua o mesmo objeto", () => {
    const table: PriceTableRules = { adjustmentPercent: 0, productPrices: { outro: 10 } };
    const catalog = [amplificador, instalacao];
    const result = applyPriceTableToCatalog(catalog, table);
    expect(result[0]).toBe(amplificador);
    expect(result[1]).toBe(instalacao);
  });
});
