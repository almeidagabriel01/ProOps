import {
  sanitizeProposalPricingDetails,
  sanitizeProposalProductsInput,
} from "./proposal-products-sanitize";

/**
 * O número de painéis de uma linha por medida era descartado ao salvar: a
 * proposta reaberta mostrava outra quantidade de painéis, e quem lia o
 * Firestore direto (Lia, relatórios) nunca via o campo.
 */
describe("sanitizeProposalPricingDetails: painéis", () => {
  it.each([
    [{ mode: "curtain_meter", width: 1.2, height: 2.5, panels: 3 }, { mode: "curtain_meter", width: 1.2, height: 2.5, area: 3, panels: 3 }],
    [{ mode: "curtain_width", width: 2, panels: 2 }, { mode: "curtain_width", width: 2, panels: 2 }],
    [
      { mode: "curtain_height", width: 2, tierId: "t1", maxHeight: 2.8, panels: 4 },
      { mode: "curtain_height", width: 2, tierId: "t1", maxHeight: 2.8, panels: 4 },
    ],
  ])("guarda os painéis em %p", (input, expected) => {
    expect(sanitizeProposalPricingDetails(input)).toEqual(expected);
  });

  it.each([0, -1, 1.5, 100, null, undefined, "abc"])(
    "painéis inválidos (%p) ficam de fora",
    (panels) => {
      expect(sanitizeProposalPricingDetails({ mode: "curtain_width", width: 2, panels })).toEqual({
        mode: "curtain_width",
        width: 2,
      });
    },
  );

  it("modo padrão não carrega medida nem painel", () => {
    expect(sanitizeProposalPricingDetails({ mode: "standard", panels: 3, width: 9 })).toEqual({ mode: "standard" });
  });
});

describe("sanitizeProposalProductsInput", () => {
  it("serviço é sempre padrão, mesmo mandando medida", () => {
    const [line] = sanitizeProposalProductsInput([
      { itemType: "service", pricingDetails: { mode: "curtain_width", width: 2, panels: 2 } },
    ]);
    expect(line.pricingDetails).toEqual({ mode: "standard" });
  });

  it("produto por medida chega gravado com os painéis", () => {
    const [line] = sanitizeProposalProductsInput([
      {
        productId: "p1",
        quantity: 6,
        pricingDetails: { mode: "curtain_meter", width: 1, height: 3, panels: 2 },
      },
    ]);
    expect(line.pricingDetails).toEqual({ mode: "curtain_meter", width: 1, height: 3, area: 3, panels: 2 });
    expect(line.quantity).toBe(6);
  });

  it("recusa lista que não é lista", () => {
    expect(() => sanitizeProposalProductsInput({})).toThrow("INVALID_PRODUCTS");
  });
});
