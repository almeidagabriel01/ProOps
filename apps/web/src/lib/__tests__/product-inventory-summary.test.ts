import { describe, expect, it, vi } from "vitest";
import type { Product } from "@/services/product-service";
import { resolveInventoryValue } from "@/lib/niches/config";
import { summarizeDimensionInventoryBalance } from "@/lib/product-inventory-summary";

// O serviço de verdade inicializa o SDK do Firebase no import.
vi.mock("@/services/product-service", () => ({
  getProductInventoryValue: (p: { inventoryValue?: unknown; stock?: unknown }) =>
    resolveInventoryValue(p),
}));

/**
 * O card de saldo da lista de produtos. Com faixas de altura ele multiplicava
 * o estoque pela SOMA das faixas (5 faixas, saldo 5 vezes maior), e produto por
 * medida sem estoque contava como 1 m.
 */
const product = (overrides: Partial<Product>): Product =>
  ({ id: "p", name: "P", price: "0", markup: "0", inventoryValue: 0, ...overrides }) as Product;

describe("summarizeDimensionInventoryBalance", () => {
  it("faixa de altura vale pela faixa mais baixa, não pela soma", () => {
    const summary = summarizeDimensionInventoryBalance([
      product({
        inventoryValue: 10,
        pricingModel: {
          mode: "curtain_height",
          tiers: [
            { id: "a", maxHeight: 2.2, basePrice: 100, markup: 50 },
            { id: "b", maxHeight: 2.8, basePrice: 120, markup: 50 },
            { id: "c", maxHeight: 3.2, basePrice: 140, markup: 50 },
          ],
        },
      }),
    ]);
    expect(summary.cost).toBe(1000);
    expect(summary.revenue).toBe(1500);
    expect(summary.heightTierInsights[0]).toMatchObject({ minSellingPrice: 150, maxSellingPrice: 210 });
  });

  it.each(["curtain_meter", "curtain_width", "standard"] as const)(
    "produto %s sem estoque fica de fora",
    (mode) => {
      const summary = summarizeDimensionInventoryBalance([
        product({ price: "100", inventoryValue: 0, pricingModel: { mode } as Product["pricingModel"] }),
      ]);
      expect(summary).toMatchObject({ cost: 0, revenue: 0, consideredProducts: 0, skippedProducts: 1 });
    },
  );

  it("produto por área e por quantidade: estoque x preço", () => {
    const summary = summarizeDimensionInventoryBalance([
      product({ price: "50", markup: "100", inventoryValue: 4, pricingModel: { mode: "curtain_meter" } }),
      product({ id: "q", price: "10", markup: "0", inventoryValue: 3 }),
    ]);
    expect(summary).toMatchObject({ cost: 230, revenue: 430, consideredProducts: 2 });
  });
});
