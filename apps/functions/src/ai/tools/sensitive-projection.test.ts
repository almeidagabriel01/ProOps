import { projectProductForViewer, projectProposalForViewer } from "./sensitive-projection";

/**
 * A Lia lia o produto inteiro (custo, markup, faixas, estoque) e a proposta
 * com o custo de cada linha, e o modelo repetia ao membro o que recebia. A
 * projeção corta o que o membro não vê, antes de entregar ao modelo.
 */
const product = {
  id: "p1",
  name: "Câmera",
  price: "1167",
  markup: "50",
  inventoryValue: 4,
  stock: 4,
  pricingModel: { mode: "standard" },
};

describe("produto para a Lia", () => {
  it("com tudo liberado, leva custo, markup, estoque e o preço de venda", () => {
    const out = projectProductForViewer(product, { viewCost: true, viewStock: true });
    expect(out).toMatchObject({ price: "1167", markup: "50", inventoryValue: 4, sellingPrice: 1750.5 });
  });

  it("sem ver o custo, só o preço de venda", () => {
    const out = projectProductForViewer(product, { viewCost: false, viewStock: true });
    expect(out.sellingPrice).toBe(1750.5);
    expect(out).not.toHaveProperty("price");
    expect(out).not.toHaveProperty("markup");
    expect(out).not.toHaveProperty("pricingModel");
    expect(JSON.stringify(out)).not.toContain("1167");
  });

  it("sem ver o estoque, o estoque some", () => {
    const out = projectProductForViewer(product, { viewCost: true, viewStock: false });
    expect(out).not.toHaveProperty("inventoryValue");
    expect(out).not.toHaveProperty("stock");
  });

  it("faixa de altura: preço de venda da primeira faixa, sem o custo das faixas", () => {
    const curtain = {
      id: "p2",
      name: "Persiana",
      pricingModel: { mode: "curtain_height", tiers: [{ id: "t1", maxHeight: 2.5, basePrice: 300, markup: 80 }] },
    };
    const out = projectProductForViewer(curtain, { viewCost: false, viewStock: true });
    expect(out.sellingPrice).toBe(540);
    expect(JSON.stringify(out)).not.toContain("300");
  });
});

describe("proposta para a Lia", () => {
  const proposal = {
    id: "prop1",
    title: "Casa",
    totalValue: 3501,
    products: [{ productId: "p1", quantity: 2, unitPrice: 1167, markup: 50, total: 3501 }],
  };

  it("sem ver o custo, a linha leva o unitário de venda", () => {
    const out = projectProposalForViewer(proposal, { viewCost: false });
    const lines = out.products as Array<Record<string, unknown>>;
    expect(lines[0].unitPrice).toBe(1750.5);
    expect(lines[0]).not.toHaveProperty("markup");
    expect(out.totalValue).toBe(3501);
  });

  it("quem vê o custo recebe a proposta como está", () => {
    expect(projectProposalForViewer(proposal, { viewCost: true })).toBe(proposal);
  });
});
