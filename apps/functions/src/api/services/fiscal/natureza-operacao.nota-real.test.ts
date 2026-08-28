/**
 * Derivações conferidas contra uma NF-e **autorizada de verdade**.
 *
 * Fonte: NF-e nº 6, série 0, chave
 * `31260250759330000133550000000000061664528859`, emitida em 27/02/2026 pelo
 * CNPJ 50.759.330/0001-33 (Machado/MG) para uma pessoa física do mesmo
 * município. Venda de dois equipamentos de rede, R$ 1.372,00.
 *
 * O valor deste arquivo não é cobrir mais linhas — `natureza-operacao.test.ts`
 * já faz isso. É provar que o que o módulo *deriva* coincide com o que a SEFAZ
 * já *aceitou* daquela empresa. CFOP, CSOSN e origem são justamente os campos
 * que decidimos não guardar no produto; se a derivação estiver errada, ela
 * estará errada em toda venda, e o erro só apareceria como rejeição.
 */

import {
  DEFAULT_NATUREZA,
  deriveCfop,
  deriveSituacaoTributaria,
  deriveUnidadeComercial,
  normalizeOrigem,
} from "./natureza-operacao";

describe("derivações vs. NF-e nº 6 autorizada", () => {
  it("CFOP 5102 para venda dentro do estado", () => {
    // A nota real traz 5102 nos dois itens. 6102 seria interestadual, e
    // trocar os dois é uma das rejeições mais comuns.
    expect(deriveCfop(DEFAULT_NATUREZA, "MG", "MG")).toBe("5102");
  });

  it("CFOP 6102 se o mesmo emitente vender para fora do estado", () => {
    // A contrapartida que a nota real não exercita — e é por isso que o CFOP
    // não pode ficar guardado no produto.
    expect(deriveCfop(DEFAULT_NATUREZA, "MG", "SP")).toBe("6102");
  });

  it("CSOSN 102 para o Simples Nacional", () => {
    // A nota real traz "0102" na coluna CSOSN: origem 0 + CSOSN 102.
    expect(deriveSituacaoTributaria(1)).toEqual({ kind: "csosn", codigo: "102" });
  });

  it("origem 0 quando o produto não declara procedência", () => {
    expect(normalizeOrigem(undefined)).toBe(0);
  });

  it("unidade comercial UN", () => {
    // A nota real usa UN nos dois itens.
    expect(deriveUnidadeComercial(undefined)).toBe("UN");
    expect(deriveUnidadeComercial("unit")).toBe("UN");
  });
});
