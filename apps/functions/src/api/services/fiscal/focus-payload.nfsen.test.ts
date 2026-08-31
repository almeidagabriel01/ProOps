/**
 * Payload da DPS da NFS-e Nacional.
 *
 * Os valores esperados vêm da NFS-e nº 14 emitida em 27/07/2026 em Machado/MG
 * pelo primeiro emitente real do módulo — não de um exemplo inventado. Se o
 * mapeamento quebrar, quebra contra um documento que a Receita já aceitou.
 */

import { buildNfsenPayload, buildEmpresaPayload } from "./focus-payload";
import type { FiscalInvoiceInput, FiscalIssuerConfig } from "./fiscal-types";

const ISSUER: FiscalIssuerConfig = {
  cnpj: "50759330000133",
  razaoSocial: "50.759.330 WINICIUS GONCALVES ARAUJO DIAS",
  email: "gestao@exemplo.com.br",
  // CRT 1 = Simples Nacional.
  regimeTributario: 1,
  inscricaoMunicipal: "3411114782",
  habilitaNfe: false,
  habilitaNfse: true,
  serieNfse: "70000",
  proximoNumeroNfse: 14,
  certificadoBase64: "MIIj4gIBAzCCI54=",
  certificadoSenha: "senha",
  endereco: {
    logradouro: "Rua Major Feliciano",
    numero: "549",
    bairro: "Centro",
    municipio: "Machado",
    uf: "MG",
    cep: "37750000",
    codigoIbge: "3139003",
  },
} as FiscalIssuerConfig;

function buildInput(overrides: Partial<FiscalInvoiceInput> = {}): FiscalInvoiceInput {
  return {
    type: "nfse",
    ref: "ref-1",
    dataEmissao: "2026-07-27T10:28:44-03:00",
    valorTotal: 1500,
    issuer: ISSUER,
    recipient: {
      nome: "Cliente Exemplo",
      documento: "12345678909",
      indicadorIe: "nao_contribuinte",
      consumidorFinal: true,
      endereco: {
        logradouro: "Rua A",
        numero: "10",
        bairro: "Centro",
        municipio: "Machado",
        uf: "MG",
        cep: "37750000",
        codigoIbge: "3139003",
      },
    },
    service: {
      descricao: "PRESTACAO DE SERVICO DE INSTALACAO DE EQUIPAMENTOS ELETRONICOS.",
      codigoLc116: "31.01",
      codigoTributacaoNacional: "310102",
      valorServicos: 1500,
      // No Simples Nacional o ISS sai no DAS — a DANFSe de referência traz a
      // alíquota em branco.
      aliquotaIss: 0,
      issRetido: false,
    },
    ...overrides,
  } as FiscalInvoiceInput;
}

describe("buildNfsenPayload", () => {
  it("monta o layout plano da DPS, sem aninhamento", () => {
    const payload = buildNfsenPayload(buildInput());

    expect(payload).not.toHaveProperty("prestador");
    expect(payload).not.toHaveProperty("tomador");
    expect(payload).not.toHaveProperty("servico");
    expect(payload.cnpj_prestador).toBe("50759330000133");
    expect(payload.descricao_servico).toContain("INSTALACAO");
  });

  it("usa o código IBGE do emitente como município emissor e de prestação", () => {
    const payload = buildNfsenPayload(buildInput());

    // Numérico no emissor e string na prestação — é como o leiaute pede.
    expect(payload.codigo_municipio_emissora).toBe(3139003);
    expect(payload.codigo_municipio_prestacao).toBe("3139003");
  });

  it("deriva o código do Simples Nacional a partir do CRT", () => {
    // 1 = Simples ⇒ 3 (ME/EPP). Bate com "Optante - Microempresa ou Empresa de
    // Pequeno Porte" na DANFSe de referência.
    expect(buildNfsenPayload(buildInput()).codigo_opcao_simples_nacional).toBe(3);

    const mei = buildNfsenPayload(
      buildInput({ issuer: { ...ISSUER, regimeTributario: 4 } as FiscalIssuerConfig }),
    );
    expect(mei.codigo_opcao_simples_nacional).toBe(2);

    const normal = buildNfsenPayload(
      buildInput({ issuer: { ...ISSUER, regimeTributario: 3 } as FiscalIssuerConfig }),
    );
    expect(normal.codigo_opcao_simples_nacional).toBe(1);
  });

  it("traduz retenção de ISS para o enum do leiaute", () => {
    // 1 = não retido, 2 = retido pelo tomador. A nota de referência é "Não Retido".
    expect(buildNfsenPayload(buildInput()).tipo_retencao_iss).toBe(1);

    const retido = buildNfsenPayload(
      buildInput({ service: { ...buildInput().service!, issRetido: true } }),
    );
    expect(retido.tipo_retencao_iss).toBe(2);
  });

  it("preserva alíquota zero em vez de omitir", () => {
    // Omitir faria o Ambiente Nacional assumir outra coisa; zero é a resposta
    // certa para quem está no Simples.
    expect(buildNfsenPayload(buildInput())).toHaveProperty(
      "percentual_aliquota_relativa_municipio",
      0,
    );
  });

  it("escolhe CPF ou CNPJ do tomador pelo tamanho do documento", () => {
    expect(buildNfsenPayload(buildInput()).cpf_tomador).toBe("12345678909");

    const pj = buildNfsenPayload(
      buildInput({
        recipient: { ...buildInput().recipient, documento: "50.759.330/0001-33" },
      }),
    );
    expect(pj.cnpj_tomador).toBe("50759330000133");
    expect(pj).not.toHaveProperty("cpf_tomador");
  });

  it("achata o endereço do tomador com o sufixo do leiaute", () => {
    const payload = buildNfsenPayload(buildInput());

    expect(payload.logradouro_tomador).toBe("Rua A");
    expect(payload.numero_tomador).toBe("10");
    expect(payload.cep_tomador).toBe("37750000");
    expect(payload.codigo_municipio_tomador).toBe("3139003");
  });

  it("não manda numeração — ela vive no cadastro da empresa", () => {
    // Duas fontes da verdade para a sequência é o caminho mais curto para
    // duplicidade de numeração.
    const payload = buildNfsenPayload(buildInput());
    expect(payload).not.toHaveProperty("numero_dps");
    expect(payload).not.toHaveProperty("serie_dps");
  });

  it("manda regApTribSN E regEspTrib quando o emitente é do Simples", () => {
    // `regTrib` é sequência, não escolha. A segunda rejeição real provou isso:
    // depois que regApTribSN passou a ir, a mensagem mudou de
    // "Expected is one of ( regApTribSN, regEspTrib )" para
    // "Expected is ( regEspTrib )" — o validador cobra o PRÓXIMO elemento da
    // sequência, não uma alternativa que faltou.
    const payload = buildNfsenPayload(buildInput());

    expect(payload.regime_tributario_simples_nacional).toBe(1);
    expect(payload.regime_especial_tributacao).toBe(0);
  });

  it("manda só regEspTrib quando o emitente NÃO é do Simples", () => {
    // regApTribSN só existe para optante; enviá-lo aqui inventaria um regime
    // de apuração do Simples para quem não está no Simples.
    const payload = buildNfsenPayload(
      buildInput({ issuer: { ...ISSUER, regimeTributario: 3 } as FiscalIssuerConfig }),
    );

    expect(payload.regime_especial_tributacao).toBe(0);
    expect(payload).not.toHaveProperty("regime_tributario_simples_nacional");
  });

  it("respeita o regime de apuração configurado no emitente", () => {
    const payload = buildNfsenPayload(
      buildInput({
        issuer: { ...ISSUER, regimeApuracaoSimplesNacional: 2 } as FiscalIssuerConfig,
      }),
    );

    expect(payload.regime_tributario_simples_nacional).toBe(2);
  });

  it("preenche trib com o indicador de total de tributos", () => {
    // Segunda rejeição do mesmo XSD: "Element 'trib': Missing child
    // element(s). Expected is one of ( tribFed, totTrib )". 0 = não informar
    // os valores estimados, como a nota de referência.
    expect(buildNfsenPayload(buildInput()).indicador_total_tributacao).toBe(0);
  });

  it("recusa serviço sem código de tributação nacional", () => {
    expect(() =>
      buildNfsenPayload(
        buildInput({
          service: { ...buildInput().service!, codigoTributacaoNacional: undefined },
        }),
      ),
    ).toThrow("NFSEN_SEM_CODIGO_TRIBUTACAO_NACIONAL");
  });

  it("recusa nota de serviço sem serviço", () => {
    expect(() => buildNfsenPayload(buildInput({ service: undefined }))).toThrow(
      "NFSE_SEM_SERVICO",
    );
  });
});

describe("buildEmpresaPayload — numeração da NFS-e nacional", () => {
  it("grava série e próximo número nos campos nfsen", () => {
    const payload = buildEmpresaPayload(ISSUER);

    expect(payload.serie_nfsen_producao).toBe("70000");
    expect(payload.serie_nfsen_homologacao).toBe("70000");
    expect(payload.proximo_numero_nfsen_producao).toBe(14);
    expect(payload).not.toHaveProperty("serie_nfse_producao");
  });

  it("volta aos campos municipais no outro padrão", () => {
    const payload = buildEmpresaPayload({ ...ISSUER, padraoNfse: "municipal" });

    expect(payload.serie_nfse_producao).toBe("70000");
    expect(payload.proximo_numero_nfse_producao).toBe(14);
    expect(payload).not.toHaveProperty("serie_nfsen_producao");
  });
});
