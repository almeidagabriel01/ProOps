import { buildProposalProductRefs, productRefsFields } from "../proposal-product-refs";

describe("buildProposalProductRefs", () => {
  it("gera tipo:id único, com produto como padrão", () => {
    expect(
      buildProposalProductRefs([
        { productId: "p1", itemType: "product" },
        { productId: "p1" },
        { productId: "s1", itemType: "service" },
        { productId: "p2", itemType: "outro" },
      ]),
    ).toEqual(["product:p1", "service:s1", "product:p2"]);
  });

  it("ignora item sem productId e entrada que não é array", () => {
    expect(buildProposalProductRefs([{ productId: "" }, null, { name: "x" }])).toEqual([]);
    expect(buildProposalProductRefs(undefined)).toEqual([]);
  });

  it("mesmo id como produto e como serviço não se confundem", () => {
    expect(
      buildProposalProductRefs([
        { productId: "x", itemType: "product" },
        { productId: "x", itemType: "service" },
      ]),
    ).toEqual(["product:x", "service:x"]);
  });

  it("proposta sem item também é marcada como indexada", () => {
    expect(productRefsFields([])).toEqual({ productRefs: [], productRefsIndexed: true });
  });
});
