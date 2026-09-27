import { buildLiaProposalLine } from "./proposal-items";

/**
 * A proposta criada pela Lia saía com o preço de custo (sem markup) e ignorava
 * as medidas do produto cobrado por medida.
 */
describe("buildLiaProposalLine", () => {
  it("produto por unidade: aplica o markup do catálogo", () => {
    const line = buildLiaProposalLine(
      { name: "Módulo", price: 100, markup: "30" },
      { productId: "p1", quantity: 2 },
    );
    expect(line).toMatchObject({
      productName: "Módulo",
      quantity: 2,
      unitPrice: 100,
      markup: 30,
      total: 260,
      pricingDetails: { mode: "standard" },
    });
  });

  it("produto por unidade sem quantidade é recusado", () => {
    expect(() => buildLiaProposalLine({ name: "Módulo", price: 100 }, { productId: "p1" })).toThrow(
      /quantidade/,
    );
  });

  it("por área: largura x altura x painéis x preço de venda", () => {
    const line = buildLiaProposalLine(
      { name: "Persiana", price: 100, markup: 50, pricingModel: { mode: "curtain_meter" } },
      { productId: "p2", width: 1.2, height: 2.5, panels: 2 },
    );
    expect(line).toMatchObject({
      quantity: 6,
      total: 900,
      pricingDetails: { mode: "curtain_meter", width: 1.2, height: 2.5, area: 3, panels: 2 },
    });
  });

  it("por área sem altura é recusado com o que falta", () => {
    expect(() =>
      buildLiaProposalLine(
        { name: "Persiana", price: 100, pricingModel: { mode: "curtain_meter" } },
        { productId: "p2", width: 1.2, quantity: 3 },
      ),
    ).toThrow(/largura e a altura/);
  });

  it("por largura: largura x painéis", () => {
    const line = buildLiaProposalLine(
      { name: "Toldo", price: 80, markup: 25, pricingModel: { mode: "curtain_width" } },
      { productId: "p3", width: 3 },
    );
    expect(line).toMatchObject({ quantity: 3, total: 300 });
  });

  it("por faixa de altura: escolhe a menor faixa que comporta a altura", () => {
    const tiers = [
      { id: "a", maxHeight: 2.2, basePrice: 100, markup: 50 },
      { id: "b", maxHeight: 2.8, basePrice: 120, markup: 50 },
    ];
    const line = buildLiaProposalLine(
      { name: "Cortina", pricingModel: { mode: "curtain_height", tiers } },
      { productId: "p4", width: 2, height: 2.5 },
    );
    expect(line.pricingDetails).toEqual({ mode: "curtain_height", width: 2, tierId: "b", maxHeight: 2.8, panels: 1 });
    expect(line.total).toBe(360);
  });

  it("altura acima da última faixa é recusada", () => {
    expect(() =>
      buildLiaProposalLine(
        {
          name: "Cortina",
          pricingModel: { mode: "curtain_height", tiers: [{ id: "a", maxHeight: 2.2, basePrice: 100, markup: 0 }] },
        },
        { productId: "p4", width: 2, height: 3 },
      ),
    ).toThrow(/não cabe em nenhuma faixa/);
  });
});
