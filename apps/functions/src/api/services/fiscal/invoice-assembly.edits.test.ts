/**
 * Edição da NF-e na emissão, padrão fiscal do contato e nota avulsa.
 *
 * Os três caminhos passam pelo mesmo `buildNfe`; os testes fixam o que a
 * pessoa vê na tela (a prévia) e o que vai para o provedor (o `input`).
 */

const docs: Record<string, Record<string, unknown>> = {};

jest.mock("../../../init", () => ({
  db: {
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => {
          const data = docs[`${name}/${id}`];
          return { exists: Boolean(data), data: () => data };
        },
      }),
    }),
  },
}));
jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  assembleInvoices,
  assembleManualNfe,
  describeNfe,
} from "./invoice-assembly.service";

const TENANT = "tenant-awa";

const settings = {
  cnpj: "53967423000141",
  razaoSocial: "AWA Servicos de Automacao Ltda",
  inscricaoEstadual: "262777533",
  inscricaoMunicipal: "12345",
  regimeTributario: 1,
  percentualTotalTributosSimplesNacional: 6,
  email: "fiscal@awa.example.br",
  endereco: {
    logradouro: "3a Avenida",
    numero: "1851",
    bairro: "Centro",
    municipio: "Balneario Camboriu",
    codigoIbge: "4202008",
    uf: "SC",
    cep: "88330102",
  },
  habilitaNfe: true,
  habilitaNfse: true,
  environment: "homologacao",
  status: "ready",
  provider: "focus",
} as never;

const enderecoSc = {
  logradouro: "Rod BR 470",
  numero: "5640",
  bairro: "Valada Itoupava",
  municipio: "Rio do Sul",
  codigoIbge: "4214805",
  uf: "SC",
  cep: "89162915",
};

beforeEach(() => {
  for (const key of Object.keys(docs)) delete docs[key];
  docs["clients/frahm"] = {
    tenantId: TENANT,
    name: "Audiofrahm Industria",
    document: "27133259000167",
    indicadorIe: "contribuinte",
    inscricaoEstadual: "258248734",
    enderecoFiscal: enderecoSc,
    fiscalDefaults: {
      observacoes: "IPI destacado conforme pedido do cliente",
      ipi: { cst: "50", aliquota: 5 },
    },
  };
  docs["clients/semPadrao"] = {
    tenantId: TENANT,
    name: "Maria",
    document: "98765432100",
    enderecoFiscal: { ...enderecoSc, uf: "PR", codigoIbge: "4106902" },
  };
  docs["products/amp"] = { tenantId: TENANT, ncm: "85437019", inventoryUnit: "unit" };
  docs["products/caixa"] = { tenantId: TENANT, ncm: "85182100", inventoryUnit: "unit", situacaoTributaria: "500" };
  docs["products/deOutraEmpresa"] = { tenantId: "outro", ncm: "11111111" };
  docs["services/inst"] = {
    tenantId: TENANT,
    codigoLc116: "14.06",
    aliquotaIss: 2,
    codigoTributacaoNacional: "140601",
  };
});

const linhasProposta = [
  { productId: "amp", productName: "Amplificador", itemType: "product" as const, quantity: 1, total: 2000 },
  { productId: "inst", productName: "Instalação", itemType: "service" as const, quantity: 1, total: 500 },
  { productId: "caixa", productName: "Caixa de som", itemType: "product" as const, quantity: 2, total: 1000 },
];

describe("venda pela proposta com o padrão fiscal do contato", () => {
  it("aplica o IPI e a observação do contato, e o IPI entra no total", async () => {
    const result = await assembleInvoices({
      tenantId: TENANT,
      settings,
      clientId: "frahm",
      items: linhasProposta,
    });

    const nfe = result.invoices.find((inv) => inv.type === "nfe")!;
    expect(result.gaps).toEqual([]);
    expect(nfe.input.products?.map((p) => p.ipi)).toEqual([
      { cst: "50", aliquota: 5 },
      { cst: "50", aliquota: 5 },
    ]);
    expect(nfe.input.observacoes).toBe("IPI destacado conforme pedido do cliente");
    // 3000 de produtos + 5% de IPI.
    expect(nfe.valorTotal).toBe(3150);
    expect(nfe.input.valorTotal).toBe(3150);
    // A venda continua usando o código do produto (ST da caixa).
    expect(nfe.input.products?.[1].csosn).toBe("500");
  });

  it("a observação do documento de origem soma-se à do contato", async () => {
    const result = await assembleInvoices({
      tenantId: TENANT,
      settings,
      clientId: "frahm",
      items: linhasProposta,
      observacoes: "Pedido 545",
    });
    const nfe = result.invoices.find((inv) => inv.type === "nfe")!;
    expect(nfe.input.observacoes).toBe("IPI destacado conforme pedido do cliente | Pedido 545");
  });

  it("a edição da tela vence o padrão: IPI tirado de uma linha, observação trocada", async () => {
    const result = await assembleInvoices({
      tenantId: TENANT,
      settings,
      clientId: "frahm",
      items: linhasProposta,
      nfe: {
        observacoes: "Texto final",
        linhas: [{ index: 1, productId: "caixa", ipi: null }],
      },
    });
    const nfe = result.invoices.find((inv) => inv.type === "nfe")!;
    expect(nfe.input.products?.[0].ipi).toEqual({ cst: "50", aliquota: 5 });
    expect(nfe.input.products?.[1].ipi).toBeUndefined();
    expect(nfe.input.observacoes).toBe("Texto final");
    expect(nfe.valorTotal).toBe(3100);
  });

  it("observação apagada na tela sai sem observação", async () => {
    const result = await assembleInvoices({
      tenantId: TENANT,
      settings,
      clientId: "frahm",
      items: linhasProposta,
      nfe: { observacoes: "" },
    });
    expect(result.invoices.find((inv) => inv.type === "nfe")!.input.observacoes).toBeUndefined();
  });

  it("recusa edição de uma linha que mudou desde a tela", async () => {
    await expect(
      assembleInvoices({
        tenantId: TENANT,
        settings,
        clientId: "frahm",
        items: linhasProposta,
        nfe: { linhas: [{ index: 1, productId: "amp", ipi: null }] },
      }),
    ).rejects.toThrow("NOTA_DESATUALIZADA");
  });

  it("contato sem padrão: nada de IPI, e a nota de serviço não é afetada", async () => {
    const result = await assembleInvoices({
      tenantId: TENANT,
      settings,
      clientId: "semPadrao",
      items: linhasProposta,
    });
    const nfe = result.invoices.find((inv) => inv.type === "nfe")!;
    expect(nfe.input.products?.every((p) => !p.ipi)).toBe(true);
    expect(nfe.valorTotal).toBe(3000);
    // Destinatário no PR, emitente em SC: venda interestadual.
    expect(nfe.input.products?.[0].cfop).toBe("6102");
  });

  it("transporte e operação da tela chegam ao documento", async () => {
    const result = await assembleInvoices({
      tenantId: TENANT,
      settings,
      clientId: "semPadrao",
      items: linhasProposta,
      naturezaOperacao: "venda_mercadoria_terceiros",
      nfe: { transporte: { modalidadeFrete: 0, volumes: [{ quantidade: 1, pesoBruto: 5.5 }] } },
    });
    const nfe = result.invoices.find((inv) => inv.type === "nfe")!;
    expect(nfe.input.transporte).toEqual({
      modalidadeFrete: 0,
      volumes: [{ quantidade: 1, pesoBruto: 5.5 }],
    });
  });
});

describe("nota avulsa", () => {
  it("remessa para conserto dentro do estado: 5915, CSOSN 900, sem venda", async () => {
    const result = await assembleManualNfe({
      tenantId: TENANT,
      settings,
      clientId: "frahm",
      naturezaOperacao: "remessa_conserto",
      linhas: [
        {
          descricao: "Amplificador 70V GR 5000 BT G5 2x300W",
          ncm: "85437019",
          quantidade: 1,
          valorUnitario: 2090,
          ipi: null,
        },
      ],
      nfe: { observacoes: "" },
    });

    expect(result.gaps).toEqual([]);
    const [nfe] = result.invoices;
    const [linha] = nfe.input.products!;
    expect(linha.cfop).toBe("5915");
    expect(linha.csosn).toBe("900");
    expect(linha.unidadeComercial).toBe("UN");
    expect(linha.codigo).toBe("AVULSO-1");
    expect(nfe.input.finalidade).toBe("normal");
    expect(nfe.input.naturezaOperacao).toBe("Remessa para conserto ou reparo");
    expect(nfe.valorTotal).toBe(2090);
  });

  it("remessa para outro estado sai em 6915", async () => {
    const result = await assembleManualNfe({
      tenantId: TENANT,
      settings,
      clientId: "semPadrao",
      naturezaOperacao: "remessa_conserto",
      linhas: [{ descricao: "Central", ncm: "85176259", quantidade: 1, valorUnitario: 800 }],
    });
    expect(result.invoices[0].input.products?.[0].cfop).toBe("6915");
  });

  it("linha do catálogo herda o NCM; a de outra empresa não", async () => {
    const result = await assembleManualNfe({
      tenantId: TENANT,
      settings,
      clientId: "semPadrao",
      naturezaOperacao: "remessa_conserto",
      linhas: [
        { productId: "amp", descricao: "Amplificador", quantidade: 1, valorUnitario: 100 },
        { productId: "deOutraEmpresa", descricao: "Intruso", quantidade: 1, valorUnitario: 100 },
      ],
    });
    expect(result.invoices[0].input.products?.[0].ncm).toBe("85437019");
    expect(result.invoices[0].input.products?.[1].ncm).toBe("");
    expect(result.gaps).toEqual([
      expect.objectContaining({ scope: "nota", field: "linhas.1.ncm" }),
    ]);
  });

  it("devolução sem a chave da nota devolvida é lacuna da nota", async () => {
    const result = await assembleManualNfe({
      tenantId: TENANT,
      settings,
      clientId: "semPadrao",
      naturezaOperacao: "devolucao_compra",
      linhas: [{ descricao: "Sensor", ncm: "85311090", quantidade: 1, valorUnitario: 50 }],
    });
    expect(result.gaps).toEqual([
      expect.objectContaining({ scope: "nota", field: "notasReferenciadas" }),
    ]);
  });

  it("devolução com a chave sai com finalidade de devolução", async () => {
    const chave = "42260953967423000141550010000509361002259248";
    const result = await assembleManualNfe({
      tenantId: TENANT,
      settings,
      clientId: "semPadrao",
      naturezaOperacao: "devolucao_compra",
      linhas: [{ descricao: "Sensor", ncm: "85311090", quantidade: 1, valorUnitario: 50 }],
      nfe: { notasReferenciadas: [chave] },
    });
    expect(result.gaps).toEqual([]);
    expect(result.invoices[0].input.finalidade).toBe("devolucao");
    expect(result.invoices[0].input.notasReferenciadas).toEqual([chave]);
  });

  it("item zerado e nota sem item viram lacuna", async () => {
    const zerado = await assembleManualNfe({
      tenantId: TENANT,
      settings,
      clientId: "semPadrao",
      naturezaOperacao: "remessa_conserto",
      linhas: [{ descricao: "Brinde", ncm: "85311090", quantidade: 1, valorUnitario: 0 }],
    });
    expect(zerado.gaps).toEqual([expect.objectContaining({ field: "linhas.0.valor" })]);

    const vazia = await assembleManualNfe({
      tenantId: TENANT,
      settings,
      clientId: "semPadrao",
      naturezaOperacao: "remessa_conserto",
      linhas: [],
    });
    expect(vazia.invoices).toEqual([]);
    expect(vazia.gaps).toEqual([expect.objectContaining({ scope: "nota", field: "linhas" })]);
  });

  it("aplica o IPI padrão do contato quando a linha não diz nada", async () => {
    const result = await assembleManualNfe({
      tenantId: TENANT,
      settings,
      clientId: "frahm",
      naturezaOperacao: "remessa_conserto",
      linhas: [{ descricao: "Amplificador", ncm: "85437019", quantidade: 1, valorUnitario: 2000 }],
    });
    const [nfe] = result.invoices;
    expect(nfe.input.products?.[0].ipi).toEqual({ cst: "50", aliquota: 5 });
    expect(nfe.input.observacoes).toBe("IPI destacado conforme pedido do cliente");
    expect(nfe.valorTotal).toBe(2100);
  });

  it("cliente de outra empresa é recusado", async () => {
    docs["clients/alheio"] = { tenantId: "outro", name: "X" };
    await expect(
      assembleManualNfe({
        tenantId: TENANT,
        settings,
        clientId: "alheio",
        naturezaOperacao: "remessa_conserto",
        linhas: [],
      }),
    ).rejects.toThrow("FORBIDDEN_TENANT_MISMATCH");
  });
});

describe("describeNfe", () => {
  it("resume a nota para a tela, sem dado do emitente", async () => {
    const result = await assembleManualNfe({
      tenantId: TENANT,
      settings,
      clientId: "frahm",
      naturezaOperacao: "remessa_conserto",
      linhas: [{ descricao: "Amplificador", ncm: "85437019", quantidade: 2, valorUnitario: 1000 }],
    });
    const view = describeNfe(result.invoices[0].input);
    expect(view).toMatchObject({
      naturezaOperacao: "Remessa para conserto ou reparo",
      finalidade: "normal",
      valorProdutos: 2000,
      valorIpi: 100,
      valorTotal: 2100,
    });
    expect(view.linhas[0]).toMatchObject({ cfop: "5915", situacaoTributaria: "900", ipiValor: 100 });
    expect(JSON.stringify(view)).not.toContain("53967423000141");
  });
});
