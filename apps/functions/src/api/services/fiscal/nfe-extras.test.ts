import {
  parseIpi,
  parseNotasReferenciadas,
  parseTransporte,
  resolveIpi,
  totalIpi,
} from "./nfe-extras";

describe("resolveIpi", () => {
  it("calcula base e valor no CST tributado", () => {
    expect(resolveIpi({ cst: "50", aliquota: 10 }, 1000)).toEqual({
      cst: "50",
      codigoEnquadramento: "999",
      baseCalculo: 1000,
      aliquota: 10,
      valor: 100,
    });
  });

  it("arredonda o valor em centavos", () => {
    expect(resolveIpi({ cst: "50", aliquota: 3.25 }, 333.33).valor).toBe(10.83);
  });

  it("CST não tributado não tem base nem valor", () => {
    expect(resolveIpi({ cst: "52", aliquota: 10 }, 1000)).toEqual({
      cst: "52",
      codigoEnquadramento: "999",
    });
  });

  it("totaliza só as linhas com IPI", () => {
    expect(
      totalIpi([
        { valorTotal: 1000, ipi: { cst: "50", aliquota: 10 } },
        { valorTotal: 500 },
        { valorTotal: 200, ipi: { cst: "53" } },
      ]),
    ).toBe(100);
  });
});

describe("parseIpi", () => {
  it("ignora ausente ou sem CST", () => {
    expect(parseIpi(undefined)).toBeUndefined();
    expect(parseIpi({ aliquota: 5 })).toBeUndefined();
  });

  it("recusa CST de entrada (00 a 49)", () => {
    // CST de entrada numa nota de saída é rejeição na SEFAZ.
    expect(() => parseIpi({ cst: "00" })).toThrow("IPI_CST_INVALIDO");
  });

  it("recusa alíquota fora de 0 a 100", () => {
    expect(() => parseIpi({ cst: "50", aliquota: 150 })).toThrow("IPI_ALIQUOTA_INVALIDA");
  });

  it("aceita números como texto e limpa o enquadramento", () => {
    expect(parseIpi({ cst: "50", aliquota: "5", codigoEnquadramento: "1a2" })).toEqual({
      cst: "50",
      aliquota: 5,
      codigoEnquadramento: "12",
    });
  });
});

describe("parseTransporte", () => {
  it("sem frete e sem mais nada é ausência de transporte", () => {
    expect(parseTransporte({ modalidadeFrete: 9 })).toBeUndefined();
    expect(parseTransporte(undefined)).toBeUndefined();
  });

  it("modalidade desconhecida vira sem frete", () => {
    expect(parseTransporte({ modalidadeFrete: 7, volumes: [{ pesoBruto: 1 }] })).toEqual({
      modalidadeFrete: 9,
      volumes: [{ pesoBruto: 1 }],
    });
  });

  it("recusa documento de transportadora incompleto", () => {
    expect(() =>
      parseTransporte({ modalidadeFrete: 0, transportadora: { nome: "X", documento: "123" } }),
    ).toThrow("TRANSPORTADORA_DOCUMENTO_INVALIDO");
  });

  it("descarta volume vazio e transportadora sem nome", () => {
    expect(
      parseTransporte({
        modalidadeFrete: 1,
        transportadora: { nome: " ", documento: "48740351012767" },
        volumes: [{}, { quantidade: "2", especie: "caixa" }],
      }),
    ).toEqual({ modalidadeFrete: 1, volumes: [{ quantidade: 2, especie: "caixa" }] });
  });
});

describe("parseNotasReferenciadas", () => {
  const chave = "42260953967423000141550010000509361002259248";

  it("tira a formatação e a repetição", () => {
    expect(parseNotasReferenciadas([chave, chave.replace(/(\d{4})/g, "$1 ")])).toEqual([chave]);
  });

  it("recusa chave que não tem 44 dígitos", () => {
    expect(() => parseNotasReferenciadas(["4226"])).toThrow("CHAVE_REFERENCIADA_INVALIDA");
  });

  it("ignora o que não é lista", () => {
    expect(parseNotasReferenciadas("x")).toEqual([]);
  });
});
