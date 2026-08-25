jest.mock("../../../init", () => ({ db: { collection: jest.fn() } }));
jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { deriveIndicadorIe, resolveLineTotal } from "./invoice-assembly.service";

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
