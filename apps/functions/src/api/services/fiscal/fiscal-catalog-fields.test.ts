import {
  sanitizeProductFiscalFields,
  sanitizeServiceFiscalFields,
} from "./fiscal-catalog-fields";

describe("sanitizeServiceFiscalFields — aliquotaIss", () => {
  it("campo vazio vira null, nunca 0", () => {
    // O bug: `Number("")` e 0, e 0 e uma aliquota que `fiscal-readiness.ts`
    // aceita como valida (legitima no Simples Nacional, onde o ISS sai no DAS).
    // Sem esta guarda, um campo em branco viraria uma aliquota de 0% que o
    // usuario nunca escolheu, e a nota sairia com ela.
    expect(sanitizeServiceFiscalFields({ aliquotaIss: "" })).toEqual({
      aliquotaIss: null,
    });
  });

  it("null e undefined explicitos tambem viram null", () => {
    expect(sanitizeServiceFiscalFields({ aliquotaIss: null })).toEqual({
      aliquotaIss: null,
    });
    expect(sanitizeServiceFiscalFields({ aliquotaIss: undefined })).toEqual({
      aliquotaIss: null,
    });
  });

  it("zero digitado de proposito e preservado", () => {
    // A contrapartida do teste acima: quem esta no Simples Nacional precisa
    // conseguir gravar 0 de verdade.
    expect(sanitizeServiceFiscalFields({ aliquotaIss: 0 })).toEqual({
      aliquotaIss: 0,
    });
    expect(sanitizeServiceFiscalFields({ aliquotaIss: "0" })).toEqual({
      aliquotaIss: 0,
    });
  });

  it("aceita aliquotas normais e recusa fora da faixa", () => {
    expect(sanitizeServiceFiscalFields({ aliquotaIss: "3.5" })).toEqual({
      aliquotaIss: 3.5,
    });
    expect(sanitizeServiceFiscalFields({ aliquotaIss: "101" })).toEqual({
      aliquotaIss: null,
    });
    expect(sanitizeServiceFiscalFields({ aliquotaIss: "-1" })).toEqual({
      aliquotaIss: null,
    });
    expect(sanitizeServiceFiscalFields({ aliquotaIss: "abc" })).toEqual({
      aliquotaIss: null,
    });
  });

  it("chave ausente nao aparece na saida", () => {
    // Update parcial nao pode apagar o que o chamador nem mencionou.
    expect(sanitizeServiceFiscalFields({ codigoLc116: "31.01" })).toEqual({
      codigoLc116: "31.01",
    });
  });
});

describe("sanitizeServiceFiscalFields — campos de texto", () => {
  it("guarda os codigos do layout nacional", () => {
    // Valores reais de uma NFS-e emitida em Machado/MG: item 31.01 da LC 116,
    // codigo de tributacao nacional 310102.
    expect(
      sanitizeServiceFiscalFields({
        codigoLc116: " 31.01 ",
        codigoTributacaoNacional: "310102",
      }),
    ).toEqual({ codigoLc116: "31.01", codigoTributacaoNacional: "310102" });
  });

  it("string vazia apaga o valor salvo", () => {
    expect(sanitizeServiceFiscalFields({ codigoLc116: "" })).toEqual({
      codigoLc116: null,
    });
  });
});

describe("sanitizeProductFiscalFields", () => {
  it("mantem so os digitos do NCM e trunca em 8", () => {
    expect(sanitizeProductFiscalFields({ ncm: "8544.49.00" })).toEqual({
      ncm: "85444900",
    });
  });

  it("NCM vazio apaga o valor", () => {
    expect(sanitizeProductFiscalFields({ ncm: "" })).toEqual({ ncm: null });
  });

  it("origem fora da faixa cai para nacional", () => {
    // Diferente da aliquota: aqui 0 e o default documentado, entao colapsar
    // valor invalido em 0 e o comportamento certo.
    expect(sanitizeProductFiscalFields({ origem: 99 })).toEqual({ origem: 0 });
    expect(sanitizeProductFiscalFields({ origem: "" })).toEqual({ origem: 0 });
    expect(sanitizeProductFiscalFields({ origem: "2" })).toEqual({ origem: 2 });
  });

  it("chave ausente nao aparece na saida", () => {
    expect(sanitizeProductFiscalFields({ ncm: "85444900" })).toEqual({
      ncm: "85444900",
    });
  });
});
