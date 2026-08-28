import {
  DEFAULT_NATUREZA,
  ORIGEM_NACIONAL,
  deriveCfop,
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
