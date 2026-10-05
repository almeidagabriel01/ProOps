import {
  DEFAULT_NATUREZA,
  ORIGEM_NACIONAL,
  deriveCfop,
  deriveSituacaoTributariaOperacao,
  isNaturezaOperacao,
  naturezaFinalidade,
  naturezaReferencia,
  deriveSituacaoTributaria,
  deriveUnidadeComercial,
  describeNatureza,
  listNaturezas,
  normalizeOrigem,
} from "./natureza-operacao";

describe("deriveCfop", () => {
  it("usa 5102 dentro do estado e 6102 fora", () => {
    // O caso do nicho: instalador compra o equipamento e revende.
    expect(deriveCfop("venda_mercadoria_terceiros", "PR", "PR")).toBe("5102");
    expect(deriveCfop("venda_mercadoria_terceiros", "PR", "SP")).toBe("6102");
  });

  it("ignora caixa e espaços na UF", () => {
    expect(deriveCfop("venda_mercadoria_terceiros", " pr ", "Pr")).toBe("5102");
  });

  it("distingue produção própria de revenda", () => {
    expect(deriveCfop("venda_producao_propria", "PR", "PR")).toBe("5101");
    expect(deriveCfop("venda_producao_propria", "PR", "SP")).toBe("6101");
  });

  it("usa 7xxx para destinatário no exterior", () => {
    expect(deriveCfop("venda_mercadoria_terceiros", "PR", "EX")).toBe("7102");
  });

  it("recusa exportação em operação que não a admite", () => {
    // Cair no CFOP interestadual aqui geraria um documento que a SEFAZ aceita
    // e a aduana não.
    expect(() => deriveCfop("remessa_conserto", "PR", "EX")).toThrow(
      "NATUREZA_SEM_CFOP_EXTERIOR",
    );
  });

  it("recusa UF ausente em vez de assumir mesmo estado", () => {
    // Assumir "mesmo estado" subtributaria toda venda interestadual.
    expect(() => deriveCfop("venda_mercadoria_terceiros", "PR", "")).toThrow(
      "CFOP_UF_INDETERMINADA",
    );
    expect(() => deriveCfop("venda_mercadoria_terceiros", "", "SP")).toThrow(
      "CFOP_UF_INDETERMINADA",
    );
  });

  it("recusa natureza desconhecida", () => {
    expect(() =>
      deriveCfop("nao_existe" as Parameters<typeof deriveCfop>[0], "PR", "PR"),
    ).toThrow("NATUREZA_OPERACAO_DESCONHECIDA");
  });

  it("cobre devolução e remessas", () => {
    expect(deriveCfop("devolucao_compra", "PR", "PR")).toBe("5202");
    expect(deriveCfop("devolucao_compra", "PR", "SP")).toBe("6202");
    expect(deriveCfop("remessa_conserto", "PR", "SP")).toBe("6915");
    expect(deriveCfop("remessa_demonstracao", "PR", "PR")).toBe("5912");
  });
});

describe("naturezas disponíveis", () => {
  it("tem descrição legível para toda natureza listada", () => {
    const naturezas = listNaturezas();
    expect(naturezas.length).toBeGreaterThan(0);
    for (const { id, descricao } of naturezas) {
      expect(descricao).toBe(describeNatureza(id));
      expect(descricao.length).toBeGreaterThan(0);
    }
  });

  it("tem a revenda como padrão", () => {
    expect(DEFAULT_NATUREZA).toBe("venda_mercadoria_terceiros");
  });
});

describe("deriveSituacaoTributaria", () => {
  it("usa CSOSN 102 no Simples Nacional", () => {
    expect(deriveSituacaoTributaria(1)).toEqual({ kind: "csosn", codigo: "102" });
  });

  it("mantém CSOSN no excesso de sublimite e no MEI", () => {
    expect(deriveSituacaoTributaria(2).kind).toBe("csosn");
    expect(deriveSituacaoTributaria(4).kind).toBe("csosn");
  });

  it("usa CST 00 no regime normal", () => {
    expect(deriveSituacaoTributaria(3)).toEqual({ kind: "cst", codigo: "00" });
  });

  it("respeita o override do produto mantendo o campo do regime", () => {
    // Produto com substituição tributária no Simples é CSOSN 500 — o código
    // muda, mas continua sendo CSOSN, nunca CST.
    expect(deriveSituacaoTributaria(1, "500")).toEqual({ kind: "csosn", codigo: "500" });
    expect(deriveSituacaoTributaria(3, "60")).toEqual({ kind: "cst", codigo: "60" });
  });

  it("ignora override em branco", () => {
    expect(deriveSituacaoTributaria(1, "   ").codigo).toBe("102");
  });
});

describe("deriveUnidadeComercial", () => {
  it("mapeia o que o catálogo já guarda", () => {
    expect(deriveUnidadeComercial("unit")).toBe("UN");
    expect(deriveUnidadeComercial("meter")).toBe("M");
  });

  it("cai em UN para valor ausente ou desconhecido", () => {
    expect(deriveUnidadeComercial(undefined)).toBe("UN");
    expect(deriveUnidadeComercial("caixa")).toBe("UN");
    expect(deriveUnidadeComercial("constructor")).toBe("UN");
  });

  it("produto cobrado por área sai em M2, mesmo com estoque em metros", () => {
    // O produto curtain_meter guarda o estoque em "meter", mas a quantidade da
    // linha é largura x altura x painéis: a nota saía em "M" com valor de m².
    expect(deriveUnidadeComercial("meter", "curtain_meter")).toBe("M2");
    expect(deriveUnidadeComercial(undefined, "curtain_meter")).toBe("M2");
  });

  it("largura e faixa de altura continuam em metro linear", () => {
    expect(deriveUnidadeComercial("meter", "curtain_width")).toBe("M");
    expect(deriveUnidadeComercial("meter", "curtain_height")).toBe("M");
    expect(deriveUnidadeComercial("unit", "standard")).toBe("UN");
  });
});

describe("normalizeOrigem", () => {
  it("assume nacional quando ausente ou inválida", () => {
    expect(normalizeOrigem(undefined)).toBe(ORIGEM_NACIONAL);
    expect(normalizeOrigem("abc")).toBe(0);
    expect(normalizeOrigem(-1)).toBe(0);
    expect(normalizeOrigem(9)).toBe(0);
    expect(normalizeOrigem(1.5)).toBe(0);
  });

  it("preserva códigos válidos de 0 a 8", () => {
    expect(normalizeOrigem(1)).toBe(1);
    expect(normalizeOrigem("8")).toBe(8);
  });
});

describe("operações sem venda", () => {
  it("retornos e outras saídas têm CFOP próprio dentro e fora do estado", () => {
    expect(deriveCfop("retorno_conserto", "SC", "SC")).toBe("5916");
    expect(deriveCfop("retorno_conserto", "SC", "PR")).toBe("6916");
    expect(deriveCfop("retorno_demonstracao", "SC", "SC")).toBe("5913");
    expect(deriveCfop("outras_saidas", "SC", "RS")).toBe("6949");
  });

  it("só a devolução exige a nota referenciada e muda a finalidade", () => {
    expect(naturezaFinalidade("devolucao_compra")).toBe("devolucao");
    expect(naturezaReferencia("devolucao_compra")).toBe("obrigatoria");
    expect(naturezaFinalidade("remessa_conserto")).toBe("normal");
    expect(naturezaReferencia("remessa_conserto")).toBe("nao_se_aplica");
    expect(naturezaReferencia("retorno_conserto")).toBe("opcional");
  });

  it("a lista leva CFOP e metadados para a tela", () => {
    const remessa = listNaturezas().find((item) => item.id === "remessa_conserto");
    expect(remessa).toMatchObject({
      cfopDentroEstado: "5915",
      cfopForaEstado: "6915",
      tributada: false,
      finalidade: "normal",
    });
  });

  it("reconhece só as operações cadastradas", () => {
    expect(isNaturezaOperacao("remessa_conserto")).toBe(true);
    expect(isNaturezaOperacao("venda")).toBe(false);
    expect(isNaturezaOperacao(undefined)).toBe(false);
  });
});

describe("deriveSituacaoTributariaOperacao", () => {
  it("na venda o código do produto vence o padrão do regime", () => {
    expect(deriveSituacaoTributariaOperacao(1, "venda_mercadoria_terceiros", "500")).toEqual({
      kind: "csosn",
      codigo: "500",
    });
    expect(deriveSituacaoTributariaOperacao(1, "venda_mercadoria_terceiros")).toEqual({
      kind: "csosn",
      codigo: "102",
    });
  });

  it("fora da venda o Simples sai em 900, ignorando o código de venda do produto", () => {
    // NF 50936 da AWA: remessa para conserto em CSOSN 900. Com o 102 do
    // regime a remessa sairia tributada como venda.
    expect(deriveSituacaoTributariaOperacao(1, "remessa_conserto", "500")).toEqual({
      kind: "csosn",
      codigo: "900",
    });
    expect(deriveSituacaoTributariaOperacao(4, "devolucao_compra")).toEqual({
      kind: "csosn",
      codigo: "900",
    });
  });

  it("fora da venda o Regime Normal sai em 90", () => {
    expect(deriveSituacaoTributariaOperacao(3, "remessa_conserto")).toEqual({
      kind: "cst",
      codigo: "90",
    });
  });

  it("o código escolhido na nota vence tudo", () => {
    expect(deriveSituacaoTributariaOperacao(1, "remessa_conserto", "500", "400")).toEqual({
      kind: "csosn",
      codigo: "400",
    });
  });
});
