import { describe, expect, it } from "vitest";
import {
  markupForLineTotal,
  parseTypedMoney,
} from "@/lib/product-pricing";
import {
  recalculateProposalProduct,
  resetProposalProductPriceToDefault,
} from "@/lib/proposal-product";
import type { Product } from "@/services/product-service";
import type { ProposalProduct } from "@/types/proposal";

/**
 * Pedido de cliente (2026-10): digitar o valor final da linha (arredondar
 * para 1.600) em vez de ir mudando o markup até bater. O markup é derivado e
 * o custo não muda, para o lucro continuar certo.
 */

describe("parseTypedMoney", () => {
  it.each([
    ["1600", 1600],
    ["1.600", 1600],
    ["1.600,00", 1600],
    ["1600,5", 1600.5],
    ["1600.50", 1600.5],
    ["R$ 1.234.567,89", 1234567.89],
    ["1.5", 1.5],
    ["0,99", 0.99],
  ])("%s → %d", (input, expected) => {
    expect(parseTypedMoney(input)).toBe(expected);
  });

  it("sem número é NaN", () => {
    expect(parseTypedMoney("")).toBeNaN();
    expect(parseTypedMoney("abc")).toBeNaN();
  });
});

describe("markupForLineTotal", () => {
  it("o caso do vídeo: custo 791,84 arredondado para 1.600", () => {
    const markup = markupForLineTotal(791.84, 1, 1600);
    expect(markup).not.toBeNull();
    expect(791.84 * (1 + (markup as number) / 100)).toBeCloseTo(1600, 6);
  });

  it("divide o valor pela quantidade", () => {
    expect(markupForLineTotal(100, 3, 450)).toBe(50);
  });

  it("abaixo do custo vira markup zero", () => {
    expect(markupForLineTotal(100, 1, 80)).toBe(0);
  });

  it("sem custo ou sem quantidade não dá para derivar", () => {
    expect(markupForLineTotal(0, 1, 100)).toBeNull();
    expect(markupForLineTotal(100, 0, 100)).toBeNull();
    expect(markupForLineTotal(100, 1, Number.NaN)).toBeNull();
    expect(markupForLineTotal(100, 1, -5)).toBeNull();
  });
});

describe("quantidade não desfaz o markup da linha", () => {
  const catalogo = {
    id: "amp",
    name: "Amplificador",
    price: "791.84",
    markup: "50",
    itemType: "product",
  } as unknown as Product;

  const linha: ProposalProduct = {
    productId: "amp",
    itemType: "product",
    productName: "Amplificador",
    quantity: 1,
    unitPrice: 791.84,
    markup: 102.06102244,
    total: 1600,
  };

  it("mudar a quantidade mantém o markup editado (era trocado pelo do catálogo)", () => {
    const result = recalculateProposalProduct({ ...linha, quantity: 2 }, catalogo);
    expect(result.markup).toBeCloseTo(102.061, 3);
    expect(result.unitPrice).toBe(791.84);
    expect(result.total).toBe(3200);
  });

  it("linha sem markup próprio usa o do catálogo", () => {
    const result = recalculateProposalProduct(
      { ...linha, markup: undefined, quantity: 2 },
      catalogo,
    );
    expect(result.markup).toBe(50);
  });

  it("restaurar o valor padrão volta ao markup do catálogo", () => {
    const result = resetProposalProductPriceToDefault(linha, catalogo);
    expect(result.markup).toBe(50);
    expect(result.total).toBe(1187.76);
  });
});
