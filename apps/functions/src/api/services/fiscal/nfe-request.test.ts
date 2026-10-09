import { parseManualLines, parseNatureza, parseNfeEdits } from "./nfe-request";

describe("parseNatureza", () => {
  it("ausente é a venda", () => {
    expect(parseNatureza(undefined)).toBe("venda_mercadoria_terceiros");
    expect(parseNatureza("")).toBe("venda_mercadoria_terceiros");
  });

  it("aceita as operações da lista", () => {
    expect(parseNatureza("remessa_conserto")).toBe("remessa_conserto");
    expect(parseNatureza("devolucao_compra")).toBe("devolucao_compra");
  });

  it("recusa operação desconhecida em vez de cair na venda", () => {
    // Cair na venda em silêncio poria uma remessa na rua como venda tributada.
    expect(() => parseNatureza("remessa_qualquer")).toThrow("NATUREZA_OPERACAO_INVALIDA");
  });
});

describe("parseNfeEdits", () => {
  it("ausente é ausente", () => {
    expect(parseNfeEdits(undefined)).toBeUndefined();
  });

  it("observação vazia é intenção de apagar, e chega como texto vazio", () => {
    expect(parseNfeEdits({ observacoes: "  " })).toEqual({ observacoes: "" });
  });

  it("distingue tirar o IPI (null) de não mexer", () => {
    const edits = parseNfeEdits({
      linhas: [
        { index: 0, productId: "p1", ipi: null },
        { index: 1, productId: "p2" },
        { index: 2, productId: "p3", ipi: { cst: "50", aliquota: 5 } },
      ],
    });
    expect(edits?.linhas).toEqual([
      { index: 0, productId: "p1", ipi: null },
      { index: 1, productId: "p2" },
      { index: 2, productId: "p3", ipi: { cst: "50", aliquota: 5 } },
    ]);
  });

  it("descarta linha sem índice ou sem produto", () => {
    expect(parseNfeEdits({ linhas: [{ index: -1, productId: "p" }, { index: 0 }] })?.linhas).toEqual(
      [],
    );
  });

  it("lê ICMS, PIS e COFINS da linha", () => {
    const edits = parseNfeEdits({
      linhas: [
        {
          index: 0,
          productId: "p1",
          icms: { situacao: "101", aliquotaCredito: 1.25 },
          pis: { cst: "01", aliquota: 0.65 },
          cofins: { cst: "01", aliquota: 3 },
        },
        { index: 1, productId: "p2" },
      ],
    });
    expect(edits?.linhas?.[0]).toEqual({
      index: 0,
      productId: "p1",
      icms: { situacao: "101", aliquotaCredito: 1.25 },
      pis: { cst: "01", aliquota: 0.65 },
      cofins: { cst: "01", aliquota: 3 },
    });
    // Linha sem imposto: nada a mexer, vale o padrão.
    expect(edits?.linhas?.[1]).toEqual({ index: 1, productId: "p2" });
  });

  it("recusa código de imposto fora da lista e alíquota fora de 0 a 100", () => {
    expect(() => parseNfeEdits({ linhas: [{ index: 0, productId: "p", icms: { situacao: "201" } }] })).toThrow(
      "ICMS_SITUACAO_INVALIDA",
    );
    expect(() => parseNfeEdits({ linhas: [{ index: 0, productId: "p", icms: { aliquota: 101 } }] })).toThrow(
      "ICMS_ALIQUOTA_INVALIDA",
    );
    expect(() => parseNfeEdits({ linhas: [{ index: 0, productId: "p", pis: { cst: "03" } }] })).toThrow(
      "PIS_COFINS_CST_INVALIDO",
    );
    expect(() => parseManualLines([{ descricao: "x", cofins: { cst: "01", aliquota: -1 } }])).toThrow(
      "PIS_COFINS_ALIQUOTA_INVALIDA",
    );
  });

  it("propaga erro de chave inválida", () => {
    expect(() => parseNfeEdits({ notasReferenciadas: ["123"] })).toThrow(
      "CHAVE_REFERENCIADA_INVALIDA",
    );
  });
});

describe("parseManualLines", () => {
  it("lê linha digitada e linha do catálogo", () => {
    expect(
      parseManualLines([
        {
          descricao: "Amplificador 2x300W",
          ncm: "8543.70.19",
          unidade: "UN",
          quantidade: "1",
          valorUnitario: 2090,
        },
        { productId: "prod-1", descricao: "Caixa de som", quantidade: 2, valorUnitario: 300, ipi: null },
      ]),
    ).toEqual([
      {
        descricao: "Amplificador 2x300W",
        ncm: "85437019",
        unidade: "UN",
        quantidade: 1,
        valorUnitario: 2090,
      },
      { productId: "prod-1", descricao: "Caixa de som", quantidade: 2, valorUnitario: 300, ipi: null },
    ]);
  });

  it("recusa mais de 100 linhas", () => {
    const linhas = Array.from({ length: 101 }, () => ({ descricao: "x", quantidade: 1, valorUnitario: 1 }));
    expect(() => parseManualLines(linhas)).toThrow("NOTA_AVULSA_ITENS_DEMAIS");
  });
});
