import { describe, expect, it } from "vitest";
import {
  EMPTY_TRANSPORTE,
  invoiceEditorPath,
  ipiFromApi,
  ipiToRequest,
  ipiValor,
  manualRequest,
  newManualLine,
  parseChaves,
  parseDecimal,
  proposalRequest,
  transporteToRequest,
  transportadoraDocumentoValido,
  type NfeFormState,
} from "../nfe-form";

const CHAVE = "42260953967423000141550010000509361002259248";

const base: NfeFormState = {
  naturezaOperacao: "remessa_conserto",
  observacoes: null,
  chavesTexto: "",
  transporte: EMPTY_TRANSPORTE,
};

describe("parseDecimal", () => {
  it("aceita vírgula, ponto decimal e ponto de milhar", () => {
    expect(parseDecimal("5,5")).toBe(5.5);
    expect(parseDecimal("5.5")).toBe(5.5);
    expect(parseDecimal("1.234,50")).toBe(1234.5);
    expect(parseDecimal("")).toBeUndefined();
    expect(parseDecimal("abc")).toBeUndefined();
  });
});

describe("IPI", () => {
  it("sem CST a linha vai sem IPI (null)", () => {
    expect(ipiToRequest({ cst: "", aliquota: "5", codigoEnquadramento: "" })).toBeNull();
  });

  it("CST tributado leva a alíquota; o não tributado, não", () => {
    expect(ipiToRequest({ cst: "50", aliquota: "5,5", codigoEnquadramento: "" })).toEqual({
      cst: "50",
      aliquota: 5.5,
    });
    expect(ipiToRequest({ cst: "53", aliquota: "5", codigoEnquadramento: "301" })).toEqual({
      cst: "53",
      codigoEnquadramento: "301",
    });
  });

  it("calcula o valor como o backend: valor da linha × alíquota", () => {
    expect(ipiValor({ cst: "50", aliquota: "5", codigoEnquadramento: "" }, 2090)).toBe(104.5);
    expect(ipiValor({ cst: "52", aliquota: "5", codigoEnquadramento: "" }, 2090)).toBe(0);
  });

  it("volta para o formulário com vírgula", () => {
    expect(ipiFromApi({ cst: "50", aliquota: 5.5 })).toEqual({
      cst: "50",
      aliquota: "5,5",
      codigoEnquadramento: "",
    });
    expect(ipiFromApi(undefined).cst).toBe("");
  });
});

describe("transporte", () => {
  it("sem frete e sem mais nada não vai", () => {
    expect(transporteToRequest(EMPTY_TRANSPORTE)).toBeUndefined();
  });

  it("a remessa da AWA: frete CIF, Braspress, 1 volume de 5,5 kg", () => {
    expect(
      transporteToRequest({
        ...EMPTY_TRANSPORTE,
        modalidadeFrete: 0,
        transportadoraNome: "Braspress",
        transportadoraDocumento: "48.740.351/0127-67",
        transportadoraUf: "sc",
        volumeQuantidade: "1",
        pesoBruto: "5,5",
        pesoLiquido: "5,5",
      }),
    ).toEqual({
      modalidadeFrete: 0,
      transportadora: {
        nome: "Braspress",
        documento: "48740351012767",
        inscricaoEstadual: "",
        endereco: "",
        municipio: "",
        uf: "SC",
      },
      volumes: [{ quantidade: 1, pesoBruto: 5.5, pesoLiquido: 5.5 }],
    });
  });

  it("documento da transportadora: vazio, CPF ou CNPJ", () => {
    expect(transportadoraDocumentoValido("")).toBe(true);
    expect(transportadoraDocumentoValido("987.654.321-00")).toBe(true);
    expect(transportadoraDocumentoValido("123")).toBe(false);
  });
});

describe("parseChaves", () => {
  it("separa as válidas das incompletas, sem repetir", () => {
    expect(parseChaves(`${CHAVE}\n${CHAVE.replace(/(\d{4})/g, "$1 ")}\n4226`)).toEqual({
      chaves: [CHAVE],
      invalidas: ["4226"],
    });
  });
});

describe("corpo da nota avulsa", () => {
  it("linha sem mexer no IPI não manda IPI, para valer o padrão do contato", () => {
    const linha = newManualLine({ descricao: "Amplificador", ncm: "8543.70.19", quantidade: "1", valorUnitario: 2090 });
    const body = manualRequest("c1", base, [linha]);
    expect(body).toEqual({
      clientId: "c1",
      naturezaOperacao: "remessa_conserto",
      linhas: [
        {
          descricao: "Amplificador",
          ncm: "85437019",
          unidade: "UN",
          quantidade: 1,
          valorUnitario: 2090,
        },
      ],
      nfe: { notasReferenciadas: [] },
    });
  });

  it("IPI mexido vai, inclusive para tirar (null)", () => {
    const linha = newManualLine({ descricao: "X", quantidade: "1,5", ipiTouched: true });
    const body = manualRequest("c1", base, [linha]) as { linhas: Array<Record<string, unknown>> };
    expect(body.linhas[0]).toMatchObject({ quantidade: 1.5, ipi: null });
  });

  it("observação só vai quando a pessoa mexeu; vazia é para apagar", () => {
    expect(manualRequest("c1", { ...base, observacoes: "" }, []).nfe).toEqual({
      observacoes: "",
      notasReferenciadas: [],
    });
  });

  it("leva as chaves válidas", () => {
    expect(manualRequest("c1", { ...base, chavesTexto: CHAVE }, []).nfe).toEqual({
      notasReferenciadas: [CHAVE],
    });
  });
});

describe("corpo da nota da proposta", () => {
  it("só as linhas mexidas vão como edição", () => {
    const body = proposalRequest({ ...base, naturezaOperacao: "venda_mercadoria_terceiros" }, [
      { index: 0, productId: "a", ipi: { cst: "50", aliquota: "5", codigoEnquadramento: "" }, touched: true },
      { index: 1, productId: "b", ipi: { cst: "", aliquota: "", codigoEnquadramento: "" }, touched: false },
    ]);
    expect(body).toEqual({
      naturezaOperacao: "venda_mercadoria_terceiros",
      nfe: {
        notasReferenciadas: [],
        linhas: [{ index: 0, productId: "a", ipi: { cst: "50", aliquota: 5 } }],
      },
    });
  });
});

describe("invoiceEditorPath", () => {
  it("nota avulsa e revisão da proposta", () => {
    expect(invoiceEditorPath()).toBe("/invoices/new");
    expect(invoiceEditorPath("p 1")).toBe("/invoices/new?proposal=p%201");
  });
});
