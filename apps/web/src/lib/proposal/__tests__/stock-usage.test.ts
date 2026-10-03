import { describe, expect, it } from "vitest";
import {
  productStock,
  productStockStatus,
  proposalStockUsage,
} from "@/lib/proposal/stock-usage";

describe("proposalStockUsage", () => {
  it("soma o mesmo produto em ambientes diferentes", () => {
    const usage = proposalStockUsage([
      { productId: "p1", itemType: "product", quantity: 3 },
      { productId: "p1", itemType: "product", quantity: 2 },
      { productId: "p2", itemType: "product", quantity: 1 },
    ]);
    expect(usage.get("p1")).toBe(5);
    expect(usage.get("p2")).toBe(1);
  });

  it("servico nao consome estoque", () => {
    const usage = proposalStockUsage([{ productId: "s1", itemType: "service", quantity: 4 }]);
    expect(usage.has("s1")).toBe(false);
  });

  it("linha sem itemType conta como produto", () => {
    expect(proposalStockUsage([{ productId: "p1", quantity: 2 }]).get("p1")).toBe(2);
  });

  it("produto por metro consome a largura vezes as pecas, nao o numero de pecas", () => {
    const usage = proposalStockUsage([
      {
        productId: "trilho",
        itemType: "product",
        quantity: 2,
        pricingDetails: { mode: "curtain_width", width: 2.5, panels: 2 },
      },
    ]);
    expect(usage.get("trilho")).toBe(5);
  });

  it("produto por m2 consome a area vezes as pecas", () => {
    const usage = proposalStockUsage([
      {
        productId: "tecido",
        itemType: "product",
        quantity: 1,
        pricingDetails: { mode: "curtain_meter", width: 2, height: 1.5, area: 3, panels: 2 },
      },
    ]);
    expect(usage.get("tecido")).toBe(6);
  });

  it("quantidade zero (linha fantasma) nao entra", () => {
    expect(proposalStockUsage([{ productId: "p1", quantity: 0 }]).has("p1")).toBe(false);
  });
});

describe("productStockStatus", () => {
  it("passou do estoque", () => {
    expect(productStockStatus({ inventoryValue: 4 }, 5)).toEqual({ stock: 4, used: 5, exceeded: true });
  });

  it("igual ao estoque nao avisa", () => {
    expect(productStockStatus({ inventoryValue: 5 }, 5)?.exceeded).toBe(false);
  });

  it("sem uso na proposta nao avisa, mesmo com estoque zerado", () => {
    expect(productStockStatus({ inventoryValue: 0 }, 0)?.exceeded).toBe(false);
  });

  it("estoque zerado e produto na proposta avisa", () => {
    expect(productStockStatus({ inventoryValue: 0 }, 1)?.exceeded).toBe(true);
  });

  it("decimal de metro nao avisa por arredondamento", () => {
    expect(productStockStatus({ inventoryValue: 0.3 }, 0.1 + 0.2)?.exceeded).toBe(false);
  });

  it("servico e produto sem saldo numerico nao tem estoque", () => {
    expect(productStock({ itemType: "service", inventoryValue: 3 })).toBeNull();
    expect(productStock({ inventoryValue: "abc" })).toBeNull();
    expect(productStockStatus({}, 3)).toBeNull();
  });

  it("produto antigo so com `stock` usa o campo legado", () => {
    expect(productStock({ stock: 7 })).toBe(7);
  });
});
