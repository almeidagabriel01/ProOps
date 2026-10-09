/**
 * ICMS, crédito do Simples, PIS e COFINS no payload do Focus, e a mensagem
 * legal do crédito nas informações complementares.
 *
 * Os valores chegam calculados (`line-taxes.ts`); aqui o que se fixa são os
 * nomes de campo do provedor e o que fica de fora quando o código não aceita.
 */

import { buildNfePayload } from "./focus-payload";
import type { FiscalInvoiceInput, FiscalProductItem } from "./fiscal-types";

const item: FiscalProductItem = {
  codigo: "151",
  descricao: "Amplificador",
  ncm: "85437019",
  cfop: "5102",
  origem: 0,
  unidadeComercial: "UN",
  quantidade: 1,
  valorUnitario: 1000,
  valorTotal: 1000,
  icms: { kind: "csosn", situacao: "102" },
  pis: { cst: "99", baseCalculo: 0, aliquota: 0, valor: 0 },
  cofins: { cst: "99", baseCalculo: 0, aliquota: 0, valor: 0 },
};

function input(products: FiscalProductItem[], overrides: Partial<FiscalInvoiceInput> = {}): FiscalInvoiceInput {
  return {
    type: "nfe",
    ref: "inv_1",
    issuer: {
      cnpj: "53967423000141",
      razaoSocial: "AWA",
      regimeTributario: 1,
      email: "a@b.com",
      endereco: {
        logradouro: "Rua",
        numero: "1",
        bairro: "Centro",
        municipio: "Balneario Camboriu",
        codigoIbge: "4202008",
        uf: "SC",
        cep: "88330102",
      },
      certificadoBase64: "",
      certificadoSenha: "",
      habilitaNfe: true,
      habilitaNfse: false,
    },
    recipient: {
      documento: "27133259000167",
      nome: "Cliente",
      indicadorIe: "contribuinte",
      consumidorFinal: false,
    },
    products,
    dataEmissao: "2026-10-09T10:00:00-03:00",
    valorTotal: 1000,
    ...overrides,
  };
}

function firstLine(payload: Record<string, unknown>): Record<string, unknown> {
  return (payload.items as Array<Record<string, unknown>>)[0];
}

describe("ICMS da linha", () => {
  it("sem destaque vai só o código", () => {
    const line = firstLine(buildNfePayload(input([item])));
    expect(line.icms_situacao_tributaria).toBe("102");
    expect(line).not.toHaveProperty("icms_base_calculo");
    expect(line).not.toHaveProperty("icms_aliquota_credito_simples");
  });

  it("CSOSN 101 leva o crédito do Simples", () => {
    const line = firstLine(
      buildNfePayload(
        input([
          { ...item, icms: { kind: "csosn", situacao: "101", aliquotaCredito: 1.25, valorCredito: 12.5 } },
        ]),
      ),
    );
    expect(line).toMatchObject({
      icms_situacao_tributaria: "101",
      icms_aliquota_credito_simples: 1.25,
      icms_valor_credito_simples: 12.5,
    });
    expect(line).not.toHaveProperty("icms_base_calculo");
  });

  it("com destaque leva modalidade, base, redução, alíquota e valor", () => {
    const line = firstLine(
      buildNfePayload(
        input([
          {
            ...item,
            icms: { kind: "csosn", situacao: "900", baseCalculo: 600, reducaoBase: 40, aliquota: 17, valor: 102 },
          },
        ]),
      ),
    );
    expect(line).toMatchObject({
      icms_situacao_tributaria: "900",
      icms_modalidade_base_calculo: 3,
      icms_base_calculo: 600,
      icms_reducao_base_calculo: 40,
      icms_aliquota: 17,
      icms_valor: 102,
    });
  });
});

describe("PIS e COFINS da linha", () => {
  it("o padrão segue indo zerado (rejeição 745 sem os grupos)", () => {
    const line = firstLine(buildNfePayload(input([item])));
    expect(line).toMatchObject({
      pis_situacao_tributaria: "99",
      pis_base_calculo: 0,
      pis_aliquota_porcentual: 0,
      pis_valor: 0,
      cofins_situacao_tributaria: "99",
      cofins_valor: 0,
    });
  });

  it("com alíquota leva base, alíquota e valor", () => {
    const line = firstLine(
      buildNfePayload(
        input([
          {
            ...item,
            pis: { cst: "01", baseCalculo: 1000, aliquota: 0.65, valor: 6.5 },
            cofins: { cst: "01", baseCalculo: 1000, aliquota: 3, valor: 30 },
          },
        ]),
      ),
    );
    expect(line).toMatchObject({
      pis_situacao_tributaria: "01",
      pis_base_calculo: 1000,
      pis_aliquota_porcentual: 0.65,
      pis_valor: 6.5,
      cofins_aliquota_porcentual: 3,
      cofins_valor: 30,
    });
  });

  it("não tributado vai só com o código", () => {
    const line = firstLine(
      buildNfePayload(input([{ ...item, pis: { cst: "07" }, cofins: { cst: "07" } }])),
    );
    expect(line.pis_situacao_tributaria).toBe("07");
    expect(line).not.toHaveProperty("pis_base_calculo");
    expect(line).not.toHaveProperty("cofins_valor");
  });
});

describe("mensagens legais", () => {
  const mensagem =
    "Permite o aproveitamento do crédito de ICMS no valor de R$ 12,50, correspondente à alíquota de 1,25%, nos termos do art. 23 da LC 123/2006.";

  it("entram depois da observação da pessoa", () => {
    const payload = buildNfePayload(
      input([item], { observacoes: "Pedido 123", mensagensLegais: [mensagem] }),
    );
    expect(payload.informacoes_adicionais_contribuinte).toBe(`Pedido 123 | ${mensagem}`);
  });

  it("saem mesmo com a observação apagada", () => {
    const payload = buildNfePayload(input([item], { observacoes: "", mensagensLegais: [mensagem] }));
    expect(payload.informacoes_adicionais_contribuinte).toBe(mensagem);
  });

  it("sem nada, o campo não vai", () => {
    expect(buildNfePayload(input([item]))).not.toHaveProperty("informacoes_adicionais_contribuinte");
  });
});
