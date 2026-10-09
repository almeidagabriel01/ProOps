import { describe, expect, it } from "vitest";
import {
  addChave,
  decimalInput,
  EMPTY_TRANSPORTE,
  icmsFormFromView,
  icmsToRequest,
  invoiceEditorPath,
  isBlankLine,
  linesFromSource,
  pisCofinsToRequest,
  sourceFromReceived,
  taxesToRequest,
  UNTOUCHED_TAXES,
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
    const linha = newManualLine({
      descricao: "X",
      quantidade: "1,5",
      impostos: { ...UNTOUCHED_TAXES, ipi: { cst: "", aliquota: "", codigoEnquadramento: "" } },
    });
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
      {
        index: 0,
        productId: "a",
        impostos: { ...UNTOUCHED_TAXES, ipi: { cst: "50", aliquota: "5", codigoEnquadramento: "" } },
      },
      { index: 1, productId: "b", impostos: UNTOUCHED_TAXES },
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

describe("decimalInput (campo de quantidade e de alíquota)", () => {
  it("guarda dígitos, ponto e vírgula; o resto sai", () => {
    // A primeira versão do filtro apagava os dígitos: não dava para digitar a quantidade.
    expect(decimalInput("2")).toBe("2");
    expect(decimalInput("1,5")).toBe("1,5");
    expect(decimalInput("12a.3")).toBe("12.3");
    expect(decimalInput("R$ 10")).toBe("10");
  });

  it("a quantidade digitada chega na API", () => {
    const linha = newManualLine({ descricao: "X", ncm: "85437019", quantidade: decimalInput("3"), valorUnitario: 10 });
    const body = manualRequest("c1", base, [linha]) as { linhas: Array<Record<string, unknown>> };
    expect(body.linhas[0].quantidade).toBe(3);
  });
});

describe("impostos da linha", () => {
  it("imposto em que a pessoa não mexeu não vai: vale o padrão do contato", () => {
    expect(taxesToRequest(UNTOUCHED_TAXES)).toEqual({});
  });

  it("CSOSN 101 leva só o crédito, e só o que foi digitado", () => {
    expect(
      icmsToRequest({
        situacao: "101",
        reducaoBase: "10",
        aliquota: "18",
        aliquotaCredito: "1,25",
        baseCalculo: "",
        valor: "",
        valorCredito: "",
      }),
    ).toEqual({ situacao: "101", aliquotaCredito: 1.25 });
  });

  it("CSOSN 900 leva a base menor, a alíquota e o valor digitados", () => {
    expect(
      icmsToRequest({
        situacao: "900",
        reducaoBase: "",
        aliquota: "12",
        aliquotaCredito: "",
        baseCalculo: "800",
        valor: "",
        valorCredito: "",
      }),
    ).toEqual({ situacao: "900", aliquota: 12, baseCalculo: 800 });
  });

  it("102 não leva número nenhum, mesmo que tenha sobrado da troca de código", () => {
    expect(
      icmsToRequest({
        situacao: "102",
        reducaoBase: "",
        aliquota: "12",
        aliquotaCredito: "1,25",
        baseCalculo: "800",
        valor: "",
        valorCredito: "",
      }),
    ).toEqual({ situacao: "102" });
  });

  it("PIS não tributado vai só com o CST", () => {
    expect(pisCofinsToRequest({ cst: "07", aliquota: "1", baseCalculo: "", valor: "" })).toEqual({ cst: "07" });
    expect(pisCofinsToRequest({ cst: "01", aliquota: "0,65", baseCalculo: "", valor: "" })).toEqual({
      cst: "01",
      aliquota: 0.65,
    });
  });

  it("começar a editar parte do que a prévia aplicou, sem fixar os valores calculados", () => {
    expect(
      icmsFormFromView({ kind: "csosn", situacao: "101", aliquotaCredito: 1.25, valorCredito: 25 }),
    ).toEqual({
      situacao: "101",
      reducaoBase: "",
      aliquota: "",
      aliquotaCredito: "1,25",
      baseCalculo: "",
      valor: "",
      valorCredito: "",
    });
  });

  it("na nota da proposta, a linha com imposto mexido vai com índice e produto", () => {
    const body = proposalRequest(base, [
      {
        index: 1,
        productId: "caixa",
        impostos: {
          ...UNTOUCHED_TAXES,
          icms: icmsFormFromView({ kind: "csosn", situacao: "102" }),
          pis: { cst: "01", aliquota: "0,65", baseCalculo: "", valor: "" },
        },
      },
    ]) as { nfe: { linhas: unknown[] } };
    expect(body.nfe.linhas).toEqual([
      { index: 1, productId: "caixa", icms: { situacao: "102" }, pis: { cst: "01", aliquota: 0.65 } },
    ]);
  });
});

describe("nota de origem", () => {
  const doc = {
    chave: CHAVE,
    emitente: { documento: "27133259000167", nome: "Fornecedor" },
    valorTotal: 10750,
    relacao: "recebida" as const,
    itens: [
      {
        numero: 1,
        codigo: "AMP-5000",
        descricao: "Amplificador",
        ncm: "85437019",
        cfop: "6101",
        unidade: "UN",
        quantidade: 5,
        valorUnitario: 2090,
        valorTotal: 10450,
        origem: 0,
        icms: { situacao: "00", baseCalculo: 10450, aliquota: 12, valor: 1254 },
      },
      {
        numero: 2,
        codigo: "CX-01",
        descricao: "Caixa",
        ncm: "85182100",
        cfop: "6102",
        unidade: "PC",
        quantidade: 2,
        valorUnitario: 150,
        valorTotal: 300,
      },
    ],
  };

  it("a nota tem 5, mando 1: só o item escolhido, na quantidade escolhida", () => {
    const [linha, ...resto] = linesFromSource(doc, [{ numero: 1, quantidade: 1 }], {
      devolucao: false,
      icmsKind: "csosn",
    });
    expect(resto).toEqual([]);
    expect(linha).toMatchObject({
      codigo: "AMP-5000",
      descricao: "Amplificador",
      ncm: "85437019",
      origem: 0,
      unidade: "UN",
      quantidade: "1",
      valorUnitario: 2090,
      impostos: UNTOUCHED_TAXES,
    });
    const body = manualRequest("c1", base, [linha]) as { linhas: Array<Record<string, unknown>> };
    expect(body.linhas[0]).toMatchObject({ codigo: "AMP-5000", origem: 0, quantidade: 1 });
  });

  it("na devolução o ICMS da compra vem junto, com a base proporcional", () => {
    const [linha] = linesFromSource(doc, [{ numero: 1, quantidade: 2 }], { devolucao: true, icmsKind: "csosn" });
    expect(taxesToRequest(linha.impostos)).toEqual({
      icms: { situacao: "900", aliquota: 12, baseCalculo: 4180 },
    });
    // Item sem ICMS destacado na origem: nada a copiar.
    const [caixa] = linesFromSource(doc, [{ numero: 2, quantidade: 1 }], { devolucao: true, icmsKind: "cst" });
    expect(caixa.impostos).toEqual(UNTOUCHED_TAXES);
  });

  it("a recebida vira nota de origem com os itens que a lista já traz", () => {
    const origem = sourceFromReceived({
      id: "r1",
      tenantId: "t",
      chaveAcesso: CHAVE,
      versao: 1,
      status: "completa",
      emitenteCnpj: "27133259000167",
      emitenteNome: "Fornecedor",
      valorTotal: 300,
      itens: [
        { numero: 1, descricao: "Caixa", ncm: "85182100", unidade: "pc", quantidade: 2, valorUnitario: 150, valorTotal: 300 },
      ],
      createdAt: "",
      updatedAt: "",
    });
    expect(origem).toMatchObject({ chave: CHAVE, relacao: "recebida" });
    expect(origem.itens[0]).toMatchObject({ unidade: "PC", codigo: "", cfop: "" });
  });

  it("a chave entra uma vez só, e a linha em branco é substituída", () => {
    expect(addChave(`${CHAVE}\n`, CHAVE)).toBe(CHAVE);
    expect(isBlankLine(newManualLine())).toBe(true);
    expect(isBlankLine(newManualLine({ descricao: "x" }))).toBe(false);
  });
});
