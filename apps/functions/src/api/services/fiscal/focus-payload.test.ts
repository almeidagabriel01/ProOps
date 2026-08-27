import {
  buildEmpresaPayload,
  buildInvoicePayload,
  buildNfePayload,
  buildNfsePayload,
} from "./focus-payload";
import type {
  FiscalInvoiceInput,
  FiscalIssuerConfig,
  FiscalRecipient,
} from "./fiscal-types";

const issuer: FiscalIssuerConfig = {
  cnpj: "12.345.678/0001-23",
  razaoSocial: "Automacao Residencial Ltda",
  nomeFantasia: "AutoCasa",
  inscricaoEstadual: "1234567",
  inscricaoMunicipal: "98765",
  cnae: "4321-5/00",
  regimeTributario: 1,
  email: "fiscal@autocasa.example.br",
  telefone: "(41) 3033-3333",
  endereco: {
    logradouro: "Rua Joao da Silva",
    numero: "153",
    bairro: "Vila Isabel",
    municipio: "Curitiba",
    codigoIbge: "4106902",
    uf: "pr",
    cep: "80210-000",
  },
  certificadoBase64: "MIIj4gIBAzCCI54=",
  certificadoSenha: "senha-secreta",
  habilitaNfe: true,
  habilitaNfse: true,
};

const recipient: FiscalRecipient = {
  documento: "987.654.321-00",
  nome: "Maria Compradora",
  email: "maria@example.br",
  indicadorIe: "nao_contribuinte",
  consumidorFinal: true,
  endereco: {
    logradouro: "Av das Cortinas",
    numero: "1000",
    bairro: "Centro",
    municipio: "Sao Paulo",
    codigoIbge: "3550308",
    uf: "SP",
    cep: "01310-100",
  },
};

function buildInput(overrides: Partial<FiscalInvoiceInput> = {}): FiscalInvoiceInput {
  return {
    type: "nfe",
    ref: "inv_001",
    issuer,
    recipient,
    dataEmissao: "2026-08-25T10:00:00-03:00",
    valorTotal: 2500,
    products: [
      {
        codigo: "CORT-001",
        descricao: "Cortina motorizada 3m",
        ncm: "6303.92.00",
        cfop: "5.102",
        origem: 0,
        unidadeComercial: "UN",
        quantidade: 2,
        valorUnitario: 1250,
        valorTotal: 2500,
        csosn: "102",
      },
    ],
    ...overrides,
  };
}

describe("buildEmpresaPayload", () => {
  it("strips punctuation from documents and normalizes the UF", () => {
    const payload = buildEmpresaPayload(issuer);

    expect(payload.cnpj).toBe("12345678000123");
    expect(payload.cep).toBe("80210000");
    expect(payload.uf).toBe("PR");
    expect(payload.cnae).toBe("4321500");
    expect(payload.telefone).toBe("4130333333");
  });

  it("forwards the certificate and enables the requested documents", () => {
    const payload = buildEmpresaPayload(issuer);

    expect(payload.arquivo_certificado_base64).toBe("MIIj4gIBAzCCI54=");
    expect(payload.senha_certificado).toBe("senha-secreta");
    expect(payload.habilita_nfe).toBe(true);
    // NFS-e tem uma flag por padrão. No nacional (default) a municipal fica
    // desligada — e as três são enviadas sempre, inclusive falsas, para que
    // trocar de padrão não exija refazer o cadastro da empresa.
    expect(payload.habilita_nfse).toBe(false);
    expect(payload.habilita_nfsen_producao).toBe(true);
    expect(payload.habilita_nfsen_homologacao).toBe(true);
  });

  it("liga a NFS-e municipal quando o emitente é desse padrão", () => {
    const payload = buildEmpresaPayload({ ...issuer, padraoNfse: "municipal" });

    expect(payload.habilita_nfse).toBe(true);
    expect(payload.habilita_nfsen_producao).toBe(false);
    expect(payload.habilita_nfsen_homologacao).toBe(false);
  });

  it("omits optional fields left empty rather than sending blanks", () => {
    const payload = buildEmpresaPayload({
      ...issuer,
      nomeFantasia: undefined,
      inscricaoEstadual: "",
      cnae: undefined,
    });

    expect(payload).not.toHaveProperty("nome_fantasia");
    expect(payload).not.toHaveProperty("inscricao_estadual");
    expect(payload).not.toHaveProperty("cnae");
  });
});

describe("buildNfePayload", () => {
  it("routes an 11-digit document to CPF and a 14-digit one to CNPJ", () => {
    const cpfPayload = buildNfePayload(buildInput());
    expect(cpfPayload.cpf_destinatario).toBe("98765432100");
    expect(cpfPayload).not.toHaveProperty("cnpj_destinatario");

    const cnpjPayload = buildNfePayload(
      buildInput({ recipient: { ...recipient, documento: "11.222.333/0001-81" } }),
    );
    expect(cnpjPayload.cnpj_destinatario).toBe("11222333000181");
    expect(cnpjPayload).not.toHaveProperty("cpf_destinatario");
  });

  it("maps the IE indicator to the SEFAZ numeric code", () => {
    expect(buildNfePayload(buildInput()).indicador_inscricao_estadual_destinatario).toBe(9);

    expect(
      buildNfePayload(
        buildInput({ recipient: { ...recipient, indicadorIe: "contribuinte" } }),
      ).indicador_inscricao_estadual_destinatario,
    ).toBe(1);

    expect(
      buildNfePayload(buildInput({ recipient: { ...recipient, indicadorIe: "isento" } }))
        .indicador_inscricao_estadual_destinatario,
    ).toBe(2);
  });

  it("never sends an IE for a non-taxpayer recipient", () => {
    // This is rejection 805: the destination SEFAZ refuses an IE on a recipient
    // that is not an ICMS taxpayer, even when one was typed into the form.
    const payload = buildNfePayload(
      buildInput({
        recipient: {
          ...recipient,
          indicadorIe: "nao_contribuinte",
          inscricaoEstadual: "1234567",
        },
      }),
    );

    expect(payload).not.toHaveProperty("inscricao_estadual_destinatario");
  });

  it("sends the IE only when the recipient really is a taxpayer", () => {
    const payload = buildNfePayload(
      buildInput({
        recipient: {
          ...recipient,
          indicadorIe: "contribuinte",
          inscricaoEstadual: "1234567",
        },
      }),
    );

    expect(payload.inscricao_estadual_destinatario).toBe("1234567");
  });

  it("carries the recipient IBGE municipality code", () => {
    // The SEFAZ validates the municipality against its own IBGE table; the name
    // alone is one of the most common rejection causes.
    expect(buildNfePayload(buildInput()).codigo_municipio_destinatario).toBe("3550308");
  });

  it("numbers items from 1 and strips punctuation from NCM and CFOP", () => {
    const payload = buildNfePayload(buildInput());
    const items = payload.items as Array<Record<string, unknown>>;

    expect(items).toHaveLength(1);
    expect(items[0].numero_item).toBe(1);
    expect(items[0].codigo_ncm).toBe("63039200");
    expect(items[0].cfop).toBe("5102");
  });

  it("uses CSOSN for Simples Nacional and CST for the normal regime", () => {
    const simples = buildNfePayload(buildInput());
    expect((simples.items as Array<Record<string, unknown>>)[0].icms_situacao_tributaria).toBe(
      "102",
    );

    const normal = buildNfePayload(
      buildInput({
        products: [
          { ...buildInput().products![0], csosn: undefined, cstIcms: "00" },
        ],
      }),
    );
    expect((normal.items as Array<Record<string, unknown>>)[0].icms_situacao_tributaria).toBe(
      "00",
    );
  });

  it("sums the product lines into valor_produtos", () => {
    const payload = buildNfePayload(
      buildInput({
        valorTotal: 3000,
        products: [
          { ...buildInput().products![0], valorTotal: 2500 },
          { ...buildInput().products![0], codigo: "MOT-002", valorTotal: 500 },
        ],
      }),
    );

    expect(payload.valor_produtos).toBe(3000);
  });

  it("refuses an NF-e with no items", () => {
    // Failing here is free; failing at the SEFAZ may consume a number from the series.
    expect(() => buildNfePayload(buildInput({ products: [] }))).toThrow("NFE_SEM_ITENS");
  });
});

describe("buildNfsePayload", () => {
  function serviceInput(overrides: Partial<FiscalInvoiceInput> = {}): FiscalInvoiceInput {
    return buildInput({
      type: "nfse",
      products: undefined,
      valorTotal: 800,
      service: {
        descricao: "Instalacao de cortina motorizada",
        codigoLc116: "14.06",
        valorServicos: 800,
        aliquotaIss: 3,
        issRetido: false,
      },
      ...overrides,
    });
  }

  it("builds prestador, tomador and servico blocks", () => {
    const payload = buildNfsePayload(serviceInput());

    expect(payload.prestador).toMatchObject({
      cnpj: "12345678000123",
      inscricao_municipal: "98765",
      codigo_municipio: "4106902",
    });
    expect(payload.tomador).toMatchObject({
      cpf: "98765432100",
      razao_social: "Maria Compradora",
    });
    expect(payload.servico).toMatchObject({
      discriminacao: "Instalacao de cortina motorizada",
      item_lista_servico: "14.06",
      valor_servicos: 800,
      aliquota: 3,
      iss_retido: false,
    });
  });

  it("includes the NT 007/2026 fields only when supplied", () => {
    const without = buildNfsePayload(serviceInput());
    expect(without.servico).not.toHaveProperty("codigo_nbs");

    const withNt007 = buildNfsePayload(
      serviceInput({
        service: {
          descricao: "Instalacao",
          codigoLc116: "14.06",
          valorServicos: 800,
          aliquotaIss: 3,
          issRetido: false,
          nbs: "115011000",
          codigoTributacaoNacional: "140601",
        },
      }),
    );

    expect(withNt007.servico).toMatchObject({
      codigo_nbs: "115011000",
      codigo_tributacao_nacional: "140601",
    });
  });

  it("refuses an NFS-e with no service line", () => {
    expect(() => buildNfsePayload(serviceInput({ service: undefined }))).toThrow(
      "NFSE_SEM_SERVICO",
    );
  });
});

describe("buildInvoicePayload", () => {
  it("dispatches on the document type", () => {
    expect(buildInvoicePayload(buildInput())).toHaveProperty("items");

    const nfse = buildInvoicePayload(
      buildInput({
        type: "nfse",
        products: undefined,
        service: {
          descricao: "Instalacao",
          codigoLc116: "31.01",
          codigoTributacaoNacional: "310102",
          valorServicos: 800,
          aliquotaIss: 3,
          issRetido: false,
        },
      }),
    );
    // Padrão nacional é o default: layout plano da DPS, sem `servico` aninhado.
    expect(nfse).toHaveProperty("descricao_servico");
    expect(nfse).not.toHaveProperty("servico");
    expect(nfse).not.toHaveProperty("items");
  });

  it("usa o layout municipal quando o emitente é desse padrão", () => {
    const municipal = buildInvoicePayload(
      buildInput({
        type: "nfse",
        products: undefined,
        issuer: { ...buildInput().issuer, padraoNfse: "municipal" },
        service: {
          descricao: "Instalacao",
          codigoLc116: "14.06",
          valorServicos: 800,
          aliquotaIss: 3,
          issRetido: false,
        },
      }),
    );

    expect(municipal).toHaveProperty("servico");
    expect(municipal).not.toHaveProperty("descricao_servico");
  });
});
