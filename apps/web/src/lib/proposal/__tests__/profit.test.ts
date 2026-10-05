import { describe, expect, it } from "vitest";
import {
  proposalLinesProfit,
  proposalProductsCost,
  proposalProfit,
  proposalSaleValue,
} from "../profit";

// O caso do vídeo do cliente: amplificador com markup de 102%, três caixas
// com 60% e três instalações de R$ 500. O lucro mostrado era R$ 1.235,07, só
// o markup dos produtos; os R$ 1.500 de mão de obra ficavam de fora.
const amplificador = {
  itemType: "product" as const,
  quantity: 1,
  unitPrice: 791.84,
  total: 1599.52,
};
const caixas = {
  itemType: "product" as const,
  quantity: 3,
  unitPrice: 237.4375,
  total: 1139.7,
};
const instalacao = {
  itemType: "service" as const,
  quantity: 3,
  unitPrice: 500,
  total: 1500,
};
const linhas = [amplificador, caixas, instalacao];

describe("lucro da proposta", () => {
  it("conta o serviço inteiro como lucro (o caso do vídeo)", () => {
    expect(proposalSaleValue(linhas)).toBe(4239.22);
    expect(proposalProductsCost(linhas)).toBe(1504.15);
    expect(proposalLinesProfit(linhas)).toBe(2735.07);
  });

  it("sem desconto, o lucro do fechamento é igual ao das linhas", () => {
    expect(proposalProfit({ lines: linhas, finalTotal: 4239.22 })).toBe(2735.07);
  });

  it("o desconto reduz o lucro", () => {
    // 10% de desconto sobre 4.239,22
    expect(proposalProfit({ lines: linhas, finalTotal: 3815.3 })).toBe(2311.15);
  });

  it("o valor combinado substitui o total e reduz o lucro", () => {
    expect(proposalProfit({ lines: linhas, finalTotal: 4000 })).toBe(2495.85);
  });

  it("custo extra cobrado do cliente é repassado, não vira lucro", () => {
    expect(
      proposalProfit({ lines: linhas, finalTotal: 4239.22 + 200, extraExpense: 200 }),
    ).toBe(2735.07);
  });

  it("proposta só de produtos continua dando o markup", () => {
    expect(proposalLinesProfit([amplificador, caixas])).toBe(1235.07);
  });

  it("proposta só de serviço: tudo é lucro", () => {
    expect(proposalProductsCost([instalacao])).toBe(0);
    expect(proposalLinesProfit([instalacao])).toBe(1500);
  });

  it("linha sem itemType é produto", () => {
    expect(
      proposalProductsCost([{ quantity: 2, unitPrice: 10, total: 30 }]),
    ).toBe(20);
  });

  it("a mensalidade fica fora do valor, do custo e do lucro", () => {
    const mensal = {
      itemType: "service" as const,
      quantity: 1,
      unitPrice: 300,
      total: 300,
      isMonthly: true,
    };
    const produtoMensal = { ...amplificador, isMonthly: true };
    expect(proposalSaleValue([...linhas, mensal, produtoMensal])).toBe(4239.22);
    expect(proposalProductsCost([...linhas, produtoMensal])).toBe(1504.15);
    expect(proposalLinesProfit([...linhas, mensal])).toBe(2735.07);
  });

  it("produto por medida usa a quantidade cobrável como base do custo", () => {
    // persiana: 4,5 m² a R$ 100/m² de custo, 50% de markup
    expect(
      proposalLinesProfit([{ quantity: 4.5, unitPrice: 100, total: 675 }]),
    ).toBe(225);
  });
});
