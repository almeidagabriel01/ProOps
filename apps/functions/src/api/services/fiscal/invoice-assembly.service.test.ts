jest.mock("../../../init", () => ({ db: { collection: jest.fn() } }));
jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { buildProductItem, deriveIndicadorIe, resolveLineTotal } from "./invoice-assembly.service";

describe("resolveLineTotal", () => {
  it("prefere o total já negociado da linha", () => {
    // `total` é o valor fechado com o cliente; recalcular por markup poderia
    // divergir de um preço editado à mão na proposta.
    expect(
      resolveLineTotal({ productId: "p1", total: 2500, quantity: 2, unitPrice: 900, markup: 10 }),
    ).toBe(2500);
  });

  it("aplica o markup quando não há total", () => {
    // unitPrice no catálogo é o preço BASE. Mandar ele cru para a SEFAZ
    // subfaturaria a nota — o valor de venda é base × (1 + markup/100).
    expect(
      resolveLineTotal({ productId: "p1", quantity: 2, unitPrice: 1000, markup: 25 }),
    ).toBe(2500);
  });

  it("trata markup ausente como zero", () => {
    expect(resolveLineTotal({ productId: "p1", quantity: 3, unitPrice: 100 })).toBe(300);
  });

  it("ignora total zero ou negativo e cai no cálculo", () => {
    expect(resolveLineTotal({ productId: "p1", total: 0, quantity: 2, unitPrice: 50 })).toBe(100);
    expect(resolveLineTotal({ productId: "p1", total: -10, quantity: 2, unitPrice: 50 })).toBe(
      100,
    );
  });

  it("devolve zero quando não há dado suficiente", () => {
    expect(resolveLineTotal({ productId: "p1" })).toBe(0);
  });
});

describe("deriveIndicadorIe", () => {
  it("respeita o valor cadastrado no cliente", () => {
    expect(deriveIndicadorIe("11222333000181", "contribuinte")).toBe("contribuinte");
    expect(deriveIndicadorIe("98765432100", "isento")).toBe("isento");
  });

  it("nunca deriva pessoa física como isenta", () => {
    // Rejeição 805: a SEFAZ do destinatário recusa "isento" para quem
    // simplesmente não é contribuinte de ICMS. O default seguro é
    // "não contribuinte".
    expect(deriveIndicadorIe("98765432100", undefined)).toBe("nao_contribuinte");
  });

  it("usa não contribuinte como padrão também para CNPJ", () => {
    // Marcar CNPJ como contribuinte sem ter a IE em mãos geraria rejeição por
    // inscrição ausente — quem é contribuinte é declarado no cadastro.
    expect(deriveIndicadorIe("11222333000181", undefined)).toBe("nao_contribuinte");
  });
});

describe("buildProductItem: unidade comercial", () => {
  const linha = { productId: "p1", productName: "Persiana", quantity: 6, total: 900 };

  it("produto por área (m²) sai em M2", () => {
    const { item } = buildProductItem(
      linha,
      { inventoryUnit: "meter", pricingModel: { mode: "curtain_meter" } },
      { regime: 1 },
      "5102",
    );
    expect(item.unidadeComercial).toBe("M2");
    expect(item.quantidade).toBe(6);
    expect(item.valorUnitario).toBe(150);
  });

  it("produto por largura sai em M", () => {
    const { item } = buildProductItem(
      linha,
      { inventoryUnit: "meter", pricingModel: { mode: "curtain_width" } },
      { regime: 1 },
      "5102",
    );
    expect(item.unidadeComercial).toBe("M");
  });

  it("produto comum sai em UN", () => {
    const { item } = buildProductItem(linha, { inventoryUnit: "unit" }, { regime: 1 }, "5102");
    expect(item.unidadeComercial).toBe("UN");
  });

  it("sem padrão nem edição, sai como sempre saiu: CSOSN 102 e PIS/COFINS 99 zerados", () => {
    const { item, problemas } = buildProductItem(linha, { inventoryUnit: "unit" }, { regime: 1 }, "5102");
    expect(item.icms).toEqual({ kind: "csosn", situacao: "102" });
    expect(item.pis).toEqual({ cst: "99", baseCalculo: 0, aliquota: 0, valor: 0 });
    expect(item.cofins).toEqual({ cst: "99", baseCalculo: 0, aliquota: 0, valor: 0 });
    expect(problemas).toEqual([]);
  });
});
