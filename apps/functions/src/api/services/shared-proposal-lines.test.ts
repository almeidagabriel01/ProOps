import {
  sellingUnitPrice,
  stripCostFromSharedLine,
} from "./shared-proposal-lines";

describe("stripCostFromSharedLine (link público da proposta)", () => {
  it("troca o custo pelo unitário de venda e tira o markup", () => {
    const line = {
      productId: "p1",
      productName: "Câmera",
      quantity: 2,
      unitPrice: 1167,
      markup: 50,
      total: 3501,
    };

    const safe = stripCostFromSharedLine(line);

    expect(safe.unitPrice).toBe(1750.5);
    expect(safe.total).toBe(3501);
    expect(safe).not.toHaveProperty("markup");
    expect(JSON.stringify(safe)).not.toContain("1167");
  });

  it("linha por faixa de altura (persianas): mantém o total e tira o custo das faixas", () => {
    const line = {
      productId: "p2",
      productName: "Persiana",
      quantity: 1,
      unitPrice: 300,
      markup: 80,
      total: 1234.56,
      pricingDetails: {
        mode: "curtain_height",
        width: 2,
        tierId: "t1",
        maxHeight: 2.5,
        panels: 1,
      },
      pricingModel: {
        mode: "curtain_height",
        tiers: [{ id: "t1", maxHeight: 2.5, basePrice: 300, markup: 80 }],
      },
      priceManuallyEdited: true,
    };

    const safe = stripCostFromSharedLine(line);

    expect(safe.unitPrice).toBe(1234.56);
    expect(safe.total).toBe(1234.56);
    expect(safe.pricingDetails).toEqual(line.pricingDetails);
    expect(safe).not.toHaveProperty("pricingModel");
    expect(safe).not.toHaveProperty("markup");
    expect(safe).not.toHaveProperty("priceManuallyEdited");
  });

  it("linha mensal e serviço seguem a mesma regra", () => {
    const monthly = stripCostFromSharedLine({
      itemType: "service",
      isMonthly: true,
      quantity: 1,
      unitPrice: 199,
      markup: 0,
      total: 199,
    });
    expect(monthly.unitPrice).toBe(199);
    expect(monthly.isMonthly).toBe(true);
    expect(monthly).not.toHaveProperty("markup");
  });

  it("sem total: recalcula o preço de venda pelo modelo padrão", () => {
    const safe = stripCostFromSharedLine({
      quantity: 3,
      unitPrice: 100,
      markup: 25,
    });
    expect(safe.unitPrice).toBe(125);
    expect(safe.total).toBe(375);
    expect(safe).not.toHaveProperty("markup");
  });

  it("linha fantasma (quantidade zero) não divide por zero", () => {
    expect(sellingUnitPrice({ quantity: 0, unitPrice: 10, markup: 10, total: 0 })).toBe(11);
  });
});
