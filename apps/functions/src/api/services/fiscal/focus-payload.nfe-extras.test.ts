import { buildNfePayload } from "./focus-payload";
import type {
  FiscalInvoiceInput,
  FiscalIssuerConfig,
  FiscalProductItem,
  FiscalRecipient,
} from "./fiscal-types";

/**
 * IPI, transporte, devolução e nota referenciada na NF-e.
 *
 * O caso de referência é a remessa para conserto que a AWA emitia em outro
 * sistema (NF 50936, autorizada em 25/09/2026): CFOP 5915, CSOSN 900,
 * transportadora com frete por conta do remetente, 1 volume de 5,5 kg.
 */

const issuer: FiscalIssuerConfig = {
  cnpj: "53.967.423/0001-41",
  razaoSocial: "AWA Servicos de Automacao Ltda",
  inscricaoEstadual: "262777533",
  regimeTributario: 1,
  email: "fiscal@awa.example.br",
  endereco: {
    logradouro: "3a Avenida",
    numero: "1851",
    bairro: "Centro",
    municipio: "Balneario Camboriu",
    codigoIbge: "4202008",
    uf: "SC",
    cep: "88330-102",
  },
  certificadoBase64: "",
  certificadoSenha: "",
  habilitaNfe: true,
  habilitaNfse: false,
};

const recipient: FiscalRecipient = {
  documento: "27.133.259/0001-67",
  nome: "Audiofrahm Industria e Comercio",
  inscricaoEstadual: "258248734",
  indicadorIe: "contribuinte",
  consumidorFinal: false,
  endereco: {
    logradouro: "Rod BR 470",
    numero: "5640",
    bairro: "Valada Itoupava",
    municipio: "Rio do Sul",
    codigoIbge: "4214805",
    uf: "SC",
    cep: "89162-915",
  },
};

const amplificador: FiscalProductItem = {
  codigo: "151",
  descricao: "Amplificador 70V GR 5000 BT G5 2x300W",
  ncm: "85437019",
  cfop: "5915",
  origem: 0,
  unidadeComercial: "UN",
  quantidade: 1,
  valorUnitario: 2090,
  valorTotal: 2090,
  csosn: "900",
  cstPisCofins: "99",
};

function input(overrides: Partial<FiscalInvoiceInput> = {}): FiscalInvoiceInput {
  return {
    type: "nfe",
    ref: "inv_1",
    issuer,
    recipient,
    naturezaOperacao: "Remessa para conserto ou reparo",
    dataEmissao: "2026-10-05T10:00:00-03:00",
    valorTotal: 2090,
    products: [amplificador],
    ...overrides,
  };
}

describe("buildNfePayload: transporte", () => {
  it("sem transporte continua saindo como 'sem frete'", () => {
    const payload = buildNfePayload(input());
    expect(payload.modalidade_frete).toBe(9);
    expect(payload.nome_transportador).toBeUndefined();
    expect(payload.volumes).toBeUndefined();
  });

  it("leva transportadora, frete por conta do remetente e volumes", () => {
    const payload = buildNfePayload(
      input({
        transporte: {
          modalidadeFrete: 0,
          transportadora: {
            nome: "Braspress Transportes Urgentes Ltda",
            documento: "48.740.351/0127-67",
            inscricaoEstadual: "256759847",
            endereco: "Rua Francisco Pontiolli, 250",
            uf: "sc",
          },
          volumes: [{ quantidade: 1, especie: "volume(s)", pesoBruto: 5.5, pesoLiquido: 5.5 }],
        },
      }),
    );

    expect(payload.modalidade_frete).toBe(0);
    expect(payload.nome_transportador).toBe("Braspress Transportes Urgentes Ltda");
    expect(payload.cnpj_transportador).toBe("48740351012767");
    expect(payload.cpf_transportador).toBeUndefined();
    expect(payload.inscricao_estadual_transportador).toBe("256759847");
    expect(payload.uf_transportador).toBe("SC");
    expect(payload.volumes).toEqual([
      { quantidade: 1, especie: "volume(s)", peso_bruto: 5.5, peso_liquido: 5.5 },
    ]);
  });

  it("transportador pessoa física vai no campo de CPF", () => {
    const payload = buildNfePayload(
      input({
        transporte: {
          modalidadeFrete: 2,
          transportadora: { nome: "Joao Freteiro", documento: "987.654.321-00" },
        },
      }),
    );
    expect(payload.cpf_transportador).toBe("98765432100");
    expect(payload.cnpj_transportador).toBeUndefined();
  });

  it("volume só com peso não leva campo vazio", () => {
    const payload = buildNfePayload(
      input({ transporte: { modalidadeFrete: 1, volumes: [{ pesoBruto: 12.25 }] } }),
    );
    expect(payload.volumes).toEqual([{ peso_bruto: 12.25 }]);
  });
});

describe("buildNfePayload: devolução e nota referenciada", () => {
  const chave = "42260953967423000141550010000509361002259248";

  it("venda e remessa saem com finalidade normal (1)", () => {
    expect(buildNfePayload(input()).finalidade_emissao).toBe(1);
  });

  it("devolução sai com finalidade 4 e a chave da nota devolvida", () => {
    const payload = buildNfePayload(
      input({ finalidade: "devolucao", notasReferenciadas: [chave] }),
    );
    expect(payload.finalidade_emissao).toBe(4);
    expect(payload.notas_referenciadas).toEqual([{ chave_nfe: chave }]);
  });

  it("chave formatada com espaços vira só dígitos; chave cortada fica de fora", () => {
    const payload = buildNfePayload(
      input({ notasReferenciadas: ["4226 0953 9674 2300 0141 5500 1000 0509 3610 0225 9248", "123"] }),
    );
    expect(payload.notas_referenciadas).toEqual([{ chave_nfe: chave }]);
  });

  it("sem chave não manda o grupo", () => {
    expect(buildNfePayload(input()).notas_referenciadas).toBeUndefined();
  });
});

describe("buildNfePayload: IPI", () => {
  it("linha sem IPI não leva campo de IPI e a nota não leva o total", () => {
    const payload = buildNfePayload(input());
    const [line] = payload.items as Array<Record<string, unknown>>;
    expect(line.ipi_situacao_tributaria).toBeUndefined();
    expect(payload.valor_ipi).toBeUndefined();
  });

  it("IPI tributado: base = valor da linha, valor calculado e total da nota", () => {
    const payload = buildNfePayload(
      input({
        valorTotal: 2194.5,
        products: [{ ...amplificador, ipi: { cst: "50", aliquota: 5 } }],
      }),
    );
    const [line] = payload.items as Array<Record<string, unknown>>;
    expect(line.ipi_situacao_tributaria).toBe("50");
    expect(line.ipi_codigo_enquadramento_legal).toBe("999");
    expect(line.ipi_base_calculo).toBe(2090);
    expect(line.ipi_aliquota).toBe(5);
    expect(line.ipi_valor).toBe(104.5);
    expect(payload.valor_ipi).toBe(104.5);
    expect(payload.valor_total).toBe(2194.5);
  });

  it("valor digitado vence o calculado", () => {
    const payload = buildNfePayload(
      input({ products: [{ ...amplificador, ipi: { cst: "99", aliquota: 5, valor: 104.49 } }] }),
    );
    const [line] = payload.items as Array<Record<string, unknown>>;
    expect(line.ipi_valor).toBe(104.49);
  });

  it("IPI não tributado sai só com CST e enquadramento", () => {
    const payload = buildNfePayload(
      input({ products: [{ ...amplificador, ipi: { cst: "53", codigoEnquadramento: "301" } }] }),
    );
    const [line] = payload.items as Array<Record<string, unknown>>;
    expect(line.ipi_situacao_tributaria).toBe("53");
    expect(line.ipi_codigo_enquadramento_legal).toBe("301");
    expect(line.ipi_base_calculo).toBeUndefined();
    expect(line.ipi_valor).toBeUndefined();
    expect(payload.valor_ipi).toBe(0);
  });

  it("remessa em CSOSN 900 mantém o código da operação", () => {
    const [line] = buildNfePayload(input()).items as Array<Record<string, unknown>>;
    expect(line.icms_situacao_tributaria).toBe("900");
    expect(line.cfop).toBe("5915");
  });
});
