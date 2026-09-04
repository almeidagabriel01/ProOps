import { describe, it, expect } from "vitest";
import {
  buildFiscalSettingsPayload,
  type FiscalFormState,
} from "../settings-payload";

/**
 * A falha típica deste mapeamento é SILENCIOSA: um campo entra no formulário,
 * não entra no payload, e a funcionalidade fica inalcançável sem erro nenhum.
 * Foi assim com `habilitaManifestacao` — o backend aceitava o campo, a coleção
 * existia, o cron rodava, e a recepção de notas de entrada não tinha como ser
 * ligada porque o PUT nunca carregava a flag.
 */

const FORM: FiscalFormState = {
  cnpj: "50.759.330/0001-33",
  razaoSocial: "  EMPRESA TESTE  ",
  nomeFantasia: "",
  inscricaoEstadual: "0046217750023",
  inscricaoMunicipal: "3411114782",
  cnae: "6209100",
  regimeTributario: 1,
  percentualSimplesNacional: "6",
  email: "fiscal@exemplo.com.br",
  telefone: "",
  endereco: {
    logradouro: "Rua A",
    numero: "1",
    complemento: "",
    bairro: "Centro",
    municipio: "Machado",
    codigoIbge: "3139003",
    uf: "mg",
    cep: "37750-000",
  },
  habilitaNfe: false,
  habilitaNfse: true,
  habilitaManifestacao: false,
  dataInicioRecebimento: "",
  padraoNfse: "nacional",
  serieNfe: "",
  proximoNumeroNfe: "",
  serieNfse: "1",
  proximoNumeroNfse: "1",
  certificadoValidade: "",
  certificadoSenha: "",
};

describe("buildFiscalSettingsPayload", () => {
  it("leva a flag de recepção de notas de entrada", () => {
    expect(
      buildFiscalSettingsPayload({ ...FORM, habilitaManifestacao: true })
        .habilitaManifestacao,
    ).toBe(true);
  });

  it("leva a flag também quando desligada — o backend precisa saber para desligar", () => {
    // Omitir quando `false` deixaria a recepção ligada para sempre depois do
    // primeiro "sim": o backend só sabe desligar recebendo `false`.
    const payload = buildFiscalSettingsPayload(FORM);

    expect(payload).toHaveProperty("habilitaManifestacao");
    expect(payload.habilitaManifestacao).toBe(false);
  });

  it("normaliza os campos que a SEFAZ valida por formato", () => {
    const payload = buildFiscalSettingsPayload(FORM);

    expect(payload.cnpj).toBe("50759330000133");
    expect(payload.endereco.cep).toBe("37750000");
    expect(payload.endereco.uf).toBe("MG");
    expect(payload.razaoSocial).toBe("EMPRESA TESTE");
  });

  it("converte número vazio em undefined, nunca 0", () => {
    // 0 é valor válido em quase todos estes campos — série 0, alíquota 0%.
    // Mandar 0 por engano é o sistema escolhendo no lugar do usuário.
    const payload = buildFiscalSettingsPayload({
      ...FORM,
      serieNfe: "",
      proximoNumeroNfe: "",
      percentualSimplesNacional: "",
    });

    expect(payload.serieNfe).toBeUndefined();
    expect(payload.proximoNumeroNfe).toBeUndefined();
    expect(payload.percentualTotalTributosSimplesNacional).toBeUndefined();
  });

  it("preserva o zero que o usuário digitou de fato", () => {
    const payload = buildFiscalSettingsPayload({
      ...FORM,
      percentualSimplesNacional: "0",
      serieNfe: "0",
    });

    expect(payload.percentualTotalTributosSimplesNacional).toBe(0);
    expect(payload.serieNfe).toBe(0);
  });

  it("aceita alíquota digitada com vírgula", () => {
    expect(
      buildFiscalSettingsPayload({ ...FORM, percentualSimplesNacional: "6,75" })
        .percentualTotalTributosSimplesNacional,
    ).toBe(6.75);
  });

  it("omite a senha do certificado quando não foi digitada", () => {
    // String vazia aqui apagaria a senha guardada em KMS e o emitente pararia
    // de assinar, sem nada na tela dizendo por quê.
    expect(buildFiscalSettingsPayload(FORM).certificadoSenha).toBeUndefined();
  });
});

describe("data de início de recebimento", () => {
  /**
   * Ela é IRREVERSÍVEL no provedor e é controle de custo: notas anteriores a
   * ela são descartadas e não cobradas; sem ela, o provedor puxa todo o
   * histórico disponível e cobra por cada nota.
   */
  it("vai junto quando a recepção está ligada", () => {
    const payload = buildFiscalSettingsPayload({
      ...FORM,
      habilitaManifestacao: true,
      dataInicioRecebimento: "2026-09-04",
    });

    expect(payload.dataInicioRecebimento).toBe("2026-09-04");
  });

  it("é LIMPA quando a recepção está desligada", () => {
    // Gravar a data junto de `habilitaManifestacao: false` registraria uma
    // escolha irreversível que ninguém fez — basta o usuário ter ligado o
    // toggle, visto a data sugerida e desligado de novo antes de salvar.
    const payload = buildFiscalSettingsPayload({
      ...FORM,
      habilitaManifestacao: false,
      dataInicioRecebimento: "2026-09-04",
    });

    expect(payload.dataInicioRecebimento).toBe("");
  });
});
