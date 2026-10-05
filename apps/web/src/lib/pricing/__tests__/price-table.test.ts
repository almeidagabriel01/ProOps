import { describe, expect, it } from "vitest";
import { calculateSellingPrice } from "@/lib/product-pricing";
import {
  acceptsSpecificPrice,
  applyPriceTableAdjustment,
  deriveMarkupForPrice,
  describePriceTableAdjustment,
  resolveProductTablePrice,
  resolveServiceTablePrice,
  type PriceTableRules,
} from "@/lib/pricing/price-table";

const sensor = { id: "p1", price: "100", markup: "50" }; // venda 150
const tecido = { id: "p2", price: "40", markup: "25", pricingModel: { mode: "curtain_meter" as const } }; // 50/m²
const porFaixa = {
  id: "p3",
  price: "80",
  markup: "50",
  pricingModel: {
    mode: "curtain_height" as const,
    tiers: [
      { id: "t1", maxHeight: 1.5, basePrice: 80, markup: 50 },
      { id: "t2", maxHeight: 3, basePrice: 100, markup: 40 },
    ],
  },
};

const desconto10: PriceTableRules = { adjustmentPercent: -10 };

/** A linha da proposta grava custo e markup: o preço tem que sair do mesmo cálculo. */
function priceFromLine(cost: number, markup: number) {
  return calculateSellingPrice(cost, markup);
}

describe("sem tabela (tabela padrão)", () => {
  it("devolve o preço e o markup do catálogo", () => {
    expect(resolveProductTablePrice(sensor, null)).toEqual({
      sellingPrice: 150,
      markup: 50,
      markupApplies: true,
      belowCost: false,
      source: "catalog",
    });
    expect(resolveProductTablePrice(sensor, undefined).source).toBe("catalog");
  });

  it("tabela sem ajuste e sem preço próprio também é o catálogo", () => {
    expect(resolveProductTablePrice(sensor, { adjustmentPercent: 0 }).source).toBe("catalog");
  });
});

describe("percentual", () => {
  it("10% a menos sobre o preço de venda, com markup recalculado e custo intacto", () => {
    const result = resolveProductTablePrice(sensor, desconto10);
    expect(result).toMatchObject({ sellingPrice: 135, markup: 35, source: "percent", belowCost: false });
    expect(priceFromLine(100, result.markup!)).toBe(135);
  });

  it("acréscimo funciona do mesmo jeito", () => {
    const result = resolveProductTablePrice(sensor, { adjustmentPercent: 20 });
    expect(result.sellingPrice).toBe(180);
    expect(result.markup).toBe(80);
  });

  it("vale para produto por medida (preço por m²)", () => {
    const result = resolveProductTablePrice(tecido, desconto10);
    expect(result.sellingPrice).toBe(45);
    expect(priceFromLine(40, result.markup!)).toBe(45);
  });

  it("desconto maior que o markup deixa o preço abaixo do custo e avisa", () => {
    const result = resolveProductTablePrice({ id: "x", price: "100", markup: "10" }, { adjustmentPercent: -20 });
    expect(result.sellingPrice).toBe(88);
    expect(result.markup).toBe(-12);
    expect(result.belowCost).toBe(true);
  });

  it("nunca deixa o preço negativo", () => {
    expect(applyPriceTableAdjustment(50, -150)).toBe(0);
  });
});

describe("preço próprio", () => {
  const tabela: PriceTableRules = { adjustmentPercent: -10, productPrices: { p1: 120, p2: 47.5 } };

  it("vence o percentual para aquele produto", () => {
    const result = resolveProductTablePrice(sensor, tabela);
    expect(result).toMatchObject({ sellingPrice: 120, markup: 20, source: "specific" });
  });

  it("os outros produtos da mesma tabela seguem no percentual", () => {
    const outro = resolveProductTablePrice({ id: "p9", price: "10", markup: "100" }, tabela);
    expect(outro).toMatchObject({ sellingPrice: 18, source: "percent" });
  });

  it("vale por unidade de medida no produto por medida", () => {
    const result = resolveProductTablePrice(tecido, tabela);
    expect(result.sellingPrice).toBe(47.5);
    expect(priceFromLine(40, result.markup!)).toBe(47.5);
  });

  it("preço próprio zero ou inválido é ignorado", () => {
    expect(resolveProductTablePrice(sensor, { adjustmentPercent: 0, productPrices: { p1: 0 } }).source).toBe(
      "catalog",
    );
    expect(
      resolveProductTablePrice(sensor, { adjustmentPercent: -10, productPrices: { p1: Number.NaN } }).source,
    ).toBe("percent");
  });
});

describe("produto por faixa de altura", () => {
  it("ignora preço próprio e aplica o percentual em cada faixa", () => {
    const result = resolveProductTablePrice(porFaixa, {
      adjustmentPercent: -10,
      productPrices: { p3: 999 },
    });
    expect(result.source).toBe("percent");
    expect(result.heightTiers).toHaveLength(2);
    // faixa 1: 80 x 1,5 = 120 -> 108; faixa 2: 100 x 1,4 = 140 -> 126
    expect(priceFromLine(80, result.heightTiers![0].markup)).toBe(108);
    expect(priceFromLine(100, result.heightTiers![1].markup)).toBe(126);
    expect(result.sellingPrice).toBe(108);
    // O custo da faixa não muda.
    expect(result.heightTiers!.map((t) => t.basePrice)).toEqual([80, 100]);
  });

  it("sem percentual, as faixas são as do catálogo", () => {
    const result = resolveProductTablePrice(porFaixa, { adjustmentPercent: 0, productPrices: { p3: 999 } });
    expect(result.source).toBe("catalog");
    expect(result.heightTiers![1].markup).toBe(40);
  });

  it("a tela não oferece preço próprio para ele", () => {
    expect(acceptsSpecificPrice(porFaixa)).toBe(false);
    expect(acceptsSpecificPrice(sensor)).toBe(true);
    expect(acceptsSpecificPrice(tecido)).toBe(true);
  });
});

describe("custo zero", () => {
  const brinde = { id: "z", price: "0", markup: "0" };

  it("não há markup que leve ao preço da tabela: devolve o preço e marca que o markup não se aplica", () => {
    const result = resolveProductTablePrice(brinde, { adjustmentPercent: 0, productPrices: { z: 30 } });
    expect(result).toMatchObject({ sellingPrice: 30, markup: null, markupApplies: false, source: "specific" });
  });

  it("percentual sobre preço zero continua zero e não muda nada", () => {
    const result = resolveProductTablePrice(brinde, desconto10);
    expect(result.sellingPrice).toBe(0);
    expect(result.markupApplies).toBe(true);
  });

  it("deriveMarkupForPrice devolve null com custo zero ou negativo", () => {
    expect(deriveMarkupForPrice(0, 10)).toBeNull();
    expect(deriveMarkupForPrice(-5, 10)).toBeNull();
  });
});

describe("arredondamento", () => {
  it("o preço da tabela sai em centavos", () => {
    // 33,33 x 0,9 = 29,997
    const result = resolveProductTablePrice({ id: "r", price: "33.33", markup: "0" }, desconto10);
    expect(result.sellingPrice).toBe(30);
  });

  it("o markup derivado reproduz o preço da tabela no centavo, com custo grande", () => {
    const cost = 12_345.67;
    for (const price of [13_579.99, 15_000.01, 9_999.99, 12_345.68]) {
      const markup = deriveMarkupForPrice(cost, price)!;
      expect(calculateSellingPrice(cost, markup)).toBe(price);
    }
  });

  it("usa o markup mais curto que acerta o centavo", () => {
    expect(deriveMarkupForPrice(100, 135)).toBe(35);
    expect(deriveMarkupForPrice(3, 10)).toBe(233.33);
  });

  it("preço próprio com mais casas é arredondado a centavo", () => {
    const result = resolveProductTablePrice(sensor, { adjustmentPercent: 0, productPrices: { p1: 99.999 } });
    expect(result.sellingPrice).toBe(100);
  });
});

describe("serviços", () => {
  const instalacao = { id: "s1", price: "200" };

  it("percentual e preço próprio mudam o preço direto (o serviço não tem custo)", () => {
    expect(resolveServiceTablePrice(instalacao, null)).toEqual({ sellingPrice: 200, source: "catalog" });
    expect(resolveServiceTablePrice(instalacao, desconto10)).toEqual({ sellingPrice: 180, source: "percent" });
    expect(
      resolveServiceTablePrice(instalacao, { adjustmentPercent: -10, servicePrices: { s1: 150 } }),
    ).toEqual({ sellingPrice: 150, source: "specific" });
  });

  it("preço próprio de produto não vale para serviço de mesmo id", () => {
    expect(
      resolveServiceTablePrice(instalacao, { adjustmentPercent: 0, productPrices: { s1: 1 } }).source,
    ).toBe("catalog");
  });
});

describe("describePriceTableAdjustment", () => {
  it("descreve desconto, acréscimo e ausência de ajuste", () => {
    expect(describePriceTableAdjustment(-10)).toBe("10% de desconto");
    expect(describePriceTableAdjustment(5.5)).toBe("5,5% de acréscimo");
    expect(describePriceTableAdjustment(0)).toBe("Sem ajuste");
  });
});
