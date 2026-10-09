import {
  mensagensCreditoSimples,
  resolveLineTaxes,
  taxTotals,
  type ResolveLineTaxesParams,
} from "./line-taxes";

function resolve(overrides: Partial<ResolveLineTaxesParams> = {}) {
  return resolveLineTaxes({
    regime: 1,
    natureza: "venda_mercadoria_terceiros",
    valorLinha: 1000,
    descricao: "Amplificador",
    ...overrides,
  });
}

const PIS_ZERADO = { cst: "99", baseCalculo: 0, aliquota: 0, valor: 0 };

describe("resolveLineTaxes: padrão", () => {
  it("venda no Simples sai como sempre saiu: 102 e PIS/COFINS 99 zerados", () => {
    const result = resolve();
    expect(result.icms).toEqual({ kind: "csosn", situacao: "102" });
    expect(result.pis).toEqual(PIS_ZERADO);
    expect(result.cofins).toEqual(PIS_ZERADO);
    expect(result.problemas).toEqual([]);
  });

  it("fora da venda o ICMS sai 900, sem crédito mesmo com alíquota da empresa", () => {
    const result = resolve({ natureza: "remessa_conserto", aliquotaCreditoSimples: 1.25 });
    expect(result.icms).toEqual({ kind: "csosn", situacao: "900" });
    expect(result.problemas).toEqual([]);
  });

  it("na venda o código do produto vale", () => {
    expect(resolve({ catalogSituacao: "500" }).icms.situacao).toBe("500");
  });
});

describe("resolveLineTaxes: crédito do Simples (CSOSN 101)", () => {
  it("o cliente 101 da AWA: CSOSN do contato e alíquota da empresa", () => {
    const result = resolve({
      contato: { icms: { situacao: "101" } },
      aliquotaCreditoSimples: 1.25,
    });
    expect(result.icms).toEqual({
      kind: "csosn",
      situacao: "101",
      aliquotaCredito: 1.25,
      valorCredito: 12.5,
    });
    expect(result.problemas).toEqual([]);
  });

  it("a alíquota da linha vence a da empresa, e o valor digitado vence o calculado", () => {
    const result = resolve({
      edits: { icms: { situacao: "101", aliquotaCredito: 2.56, valorCredito: 25.61 } },
      aliquotaCreditoSimples: 1.25,
    });
    expect(result.icms.aliquotaCredito).toBe(2.56);
    expect(result.icms.valorCredito).toBe(25.61);
  });

  it("101 sem alíquota em lugar nenhum vira problema da empresa", () => {
    const result = resolve({ edits: { icms: { situacao: "101" } } });
    expect(result.icms).toEqual({ kind: "csosn", situacao: "101" });
    expect(result.problemas).toEqual([
      expect.objectContaining({ origem: "emitente", campo: "icms.aliquotaCredito" }),
    ]);
  });

  it("o padrão do contato não entra numa remessa", () => {
    const result = resolve({
      natureza: "remessa_conserto",
      contato: { icms: { situacao: "101" }, pis: { cst: "01", aliquota: 0.65 } },
      aliquotaCreditoSimples: 1.25,
    });
    expect(result.icms).toEqual({ kind: "csosn", situacao: "900" });
    expect(result.pis).toEqual(PIS_ZERADO);
  });

  it("a edição da nota vence o contato, imposto a imposto", () => {
    const result = resolve({
      contato: { icms: { situacao: "101" }, pis: { cst: "01", aliquota: 0.65 } },
      edits: { icms: { situacao: "102" } },
      aliquotaCreditoSimples: 1.25,
    });
    expect(result.icms).toEqual({ kind: "csosn", situacao: "102" });
    // O PIS não foi editado: segue o contato.
    expect(result.pis).toEqual({ cst: "01", baseCalculo: 1000, aliquota: 0.65, valor: 6.5 });
  });
});

describe("resolveLineTaxes: destaque do ICMS", () => {
  it("CSOSN 900 com base menor que o valor do produto", () => {
    const result = resolve({
      natureza: "devolucao_compra",
      edits: { icms: { situacao: "900", baseCalculo: 800, aliquota: 12 } },
    });
    expect(result.icms).toEqual({
      kind: "csosn",
      situacao: "900",
      baseCalculo: 800,
      aliquota: 12,
      valor: 96,
    });
  });

  it("CSOSN 900 pela redução da base", () => {
    const result = resolve({
      natureza: "devolucao_compra",
      edits: { icms: { situacao: "900", reducaoBase: 40, aliquota: 17 } },
    });
    expect(result.icms).toMatchObject({ baseCalculo: 600, reducaoBase: 40, valor: 102 });
  });

  it("CSOSN 900 só ganha crédito quando alguém pede", () => {
    const result = resolve({
      natureza: "devolucao_compra",
      edits: { icms: { situacao: "900", aliquotaCredito: 3 } },
      aliquotaCreditoSimples: 1.25,
    });
    expect(result.icms).toEqual({
      kind: "csosn",
      situacao: "900",
      aliquotaCredito: 3,
      valorCredito: 30,
    });
  });

  it("Regime Normal: CST 00 exige a alíquota", () => {
    const sem = resolve({ regime: 3 });
    expect(sem.icms).toMatchObject({ kind: "cst", situacao: "00", baseCalculo: 1000, aliquota: 0, valor: 0 });
    expect(sem.problemas).toEqual([
      expect.objectContaining({ origem: "nota", campo: "icms.aliquota" }),
    ]);

    const com = resolve({ regime: 3, edits: { icms: { situacao: "00", aliquota: 17 } } });
    expect(com.icms).toEqual({ kind: "cst", situacao: "00", baseCalculo: 1000, aliquota: 17, valor: 170 });
    expect(com.problemas).toEqual([]);
  });

  it("Regime Normal: CST 20 exige a redução", () => {
    const result = resolve({ regime: 3, edits: { icms: { situacao: "20", aliquota: 17 } } });
    expect(result.problemas.map((p) => p.campo)).toEqual(["icms.reducaoBase"]);
  });

  it("código do outro regime vindo do contato vira problema do contato e cai no padrão", () => {
    const result = resolve({ regime: 3, contato: { icms: { situacao: "101" } } });
    expect(result.icms.situacao).toBe("00");
    expect(result.problemas[0]).toMatchObject({ origem: "contato", campo: "icms.situacao" });
  });

  it("código sem destaque ignora valores que tenham vindo junto", () => {
    const result = resolve({ edits: { icms: { situacao: "102", aliquota: 18, baseCalculo: 500 } } });
    expect(result.icms).toEqual({ kind: "csosn", situacao: "102" });
  });
});

describe("resolveLineTaxes: PIS e COFINS", () => {
  it("CST 01 calcula sobre o valor da linha", () => {
    const result = resolve({
      edits: { pis: { cst: "01", aliquota: 0.65 }, cofins: { cst: "01", aliquota: 3 } },
    });
    expect(result.pis).toEqual({ cst: "01", baseCalculo: 1000, aliquota: 0.65, valor: 6.5 });
    expect(result.cofins).toEqual({ cst: "01", baseCalculo: 1000, aliquota: 3, valor: 30 });
  });

  it("CST 01 com base menor e valor digitado", () => {
    const result = resolve({ edits: { pis: { cst: "01", aliquota: 1.65, baseCalculo: 500, valor: 8.26 } } });
    expect(result.pis).toEqual({ cst: "01", baseCalculo: 500, aliquota: 1.65, valor: 8.26 });
  });

  it("CST 01 sem alíquota vira problema", () => {
    const result = resolve({ edits: { cofins: { cst: "01" } } });
    expect(result.problemas).toEqual([
      expect.objectContaining({ origem: "nota", campo: "cofins.aliquota" }),
    ]);
  });

  it("CST não tributado vai só com o código", () => {
    expect(resolve({ edits: { pis: { cst: "07" } } }).pis).toEqual({ cst: "07" });
  });

  it("Regime Normal sem edição sai 49 zerado", () => {
    expect(resolve({ regime: 3 }).pis).toEqual({ cst: "49", baseCalculo: 0, aliquota: 0, valor: 0 });
  });
});

describe("mensagensCreditoSimples", () => {
  it("monta o texto do art. 23 da LC 123/2006 com valor e alíquota", () => {
    expect(
      mensagensCreditoSimples([
        { icms: { kind: "csosn", situacao: "101", aliquotaCredito: 1.25, valorCredito: 12.5 } },
        { icms: { kind: "csosn", situacao: "101", aliquotaCredito: 1.25, valorCredito: 1234.06 } },
      ]),
    ).toEqual([
      "Permite o aproveitamento do crédito de ICMS no valor de R$ 1.246,56, correspondente à alíquota de 1,25%, nos termos do art. 23 da LC 123/2006.",
    ]);
  });

  it("uma frase por alíquota", () => {
    const mensagens = mensagensCreditoSimples([
      { icms: { kind: "csosn", situacao: "101", aliquotaCredito: 2.5, valorCredito: 25 } },
      { icms: { kind: "csosn", situacao: "101", aliquotaCredito: 1.25, valorCredito: 10 } },
    ]);
    expect(mensagens).toHaveLength(2);
    expect(mensagens[0]).toContain("alíquota de 1,25%");
    expect(mensagens[1]).toContain("alíquota de 2,50%");
  });

  it("sem crédito, nada", () => {
    expect(mensagensCreditoSimples([{ icms: { kind: "csosn", situacao: "102" } }])).toEqual([]);
  });
});

describe("taxTotals", () => {
  it("soma o que foi destacado", () => {
    const totais = taxTotals([
      {
        icms: { kind: "csosn", situacao: "900", baseCalculo: 800, aliquota: 12, valor: 96 },
        pis: { cst: "01", baseCalculo: 1000, aliquota: 0.65, valor: 6.5 },
        cofins: { cst: "01", baseCalculo: 1000, aliquota: 3, valor: 30 },
      },
      {
        icms: { kind: "csosn", situacao: "101", aliquotaCredito: 1.25, valorCredito: 12.5 },
        pis: { cst: "07" },
        cofins: { cst: "07" },
      },
    ]);
    expect(totais).toEqual({
      baseIcms: 800,
      valorIcms: 96,
      valorCreditoIcms: 12.5,
      valorPis: 6.5,
      valorCofins: 30,
    });
  });
});
