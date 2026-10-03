jest.mock("../../init", () => ({ db: {} }));

import { sumProductTotals, toProposalProducts } from "./proposals.service";

/**
 * A proposta da Lia é gravada no formato do formulário: a tela lê
 * `productName`, `unitPrice`, `markup` e `total`, e o formato antigo (`name`,
 * `price`, `subtotal`) abria as linhas sem nome e sem valor.
 */
describe("toProposalProducts", () => {
  const lines = [
    {
      productId: "p1",
      productName: "Câmera",
      productDescription: "",
      quantity: 4,
      unitPrice: 200,
      markup: 50,
      total: 1200,
      pricingDetails: { mode: "standard" as const },
    },
    {
      productId: "p2",
      productName: "Persiana",
      productDescription: "Sala",
      quantity: 6,
      unitPrice: 100,
      markup: 50,
      total: 900,
      pricingDetails: { mode: "curtain_meter" as const, width: 1.2, height: 2.5, area: 3, panels: 2 },
    },
  ];

  it("grava as linhas no formato da tela", () => {
    const [first, second] = toProposalProducts(lines);
    expect(first).toMatchObject({
      lineItemId: "lia-item-1",
      productId: "p1",
      itemType: "product",
      status: "active",
      productName: "Câmera",
      quantity: 4,
      unitPrice: 200,
      markup: 50,
      total: 1200,
    });
    expect(first).not.toHaveProperty("price");
    expect(first).not.toHaveProperty("subtotal");
    expect(second.pricingDetails).toEqual({ mode: "curtain_meter", width: 1.2, height: 2.5, area: 3, panels: 2 });
  });

  it("o total da proposta é a soma dos totais de venda", () => {
    expect(sumProductTotals(toProposalProducts(lines))).toBe(2100);
  });

  it("a linha de mensalidade fica fora do total da venda", () => {
    expect(sumProductTotals([{ total: 1000 }, { total: 129, isMonthly: true }, { total: 50 }])).toBe(1050);
  });
});
