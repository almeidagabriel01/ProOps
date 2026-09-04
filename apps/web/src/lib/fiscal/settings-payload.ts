import type {
  FiscalAddress,
  FiscalNfsePadrao,
  FiscalTaxRegime,
  SaveFiscalSettingsPayload,
} from "@/services/fiscal-service";

/**
 * Estado do formulário fiscal → corpo do PUT.
 *
 * Extraído do componente para virar testável: é um mapeamento campo a campo, e
 * a falha típica dele é **silenciosa** — um campo novo entra no formulário, não
 * entra aqui, e a funcionalidade fica inalcançável sem nenhum erro em lugar
 * nenhum. Foi exatamente o que aconteceu com `habilitaManifestacao`: o toggle
 * não existia, o campo nunca era enviado, e a recepção de notas de entrada não
 * tinha como ser ligada.
 */

export interface FiscalFormState {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  cnae: string;
  regimeTributario: FiscalTaxRegime;
  percentualSimplesNacional: string;
  email: string;
  telefone: string;
  endereco: FiscalAddress;
  habilitaNfe: boolean;
  habilitaNfse: boolean;
  habilitaManifestacao: boolean;
  dataInicioRecebimento: string;
  padraoNfse: FiscalNfsePadrao;
  serieNfe: string;
  proximoNumeroNfe: string;
  serieNfse: string;
  proximoNumeroNfse: string;
  certificadoValidade: string;
  certificadoSenha: string;
}

function digits(value: string): string {
  return String(value ?? "").replace(/\D/g, "");
}

/** Campo numérico em branco vira `undefined`, nunca 0 — 0 costuma ser válido. */
function optionalNumber(value: string): number | undefined {
  const texto = String(value ?? "").trim();
  if (!texto) return undefined;
  const numero = Number(texto.replace(",", "."));
  return Number.isNaN(numero) ? undefined : numero;
}

export function buildFiscalSettingsPayload(
  form: FiscalFormState,
): SaveFiscalSettingsPayload {
  return {
    cnpj: digits(form.cnpj),
    razaoSocial: form.razaoSocial.trim(),
    nomeFantasia: form.nomeFantasia.trim(),
    inscricaoEstadual: form.inscricaoEstadual.trim(),
    inscricaoMunicipal: form.inscricaoMunicipal.trim(),
    cnae: form.cnae.trim(),
    regimeTributario: form.regimeTributario,
    // 0% é uma alíquota VÁLIDA de ISS no Simples, então em branco não pode
    // virar 0 — sairia na nota um valor que ninguém escolheu.
    percentualTotalTributosSimplesNacional: optionalNumber(
      form.percentualSimplesNacional,
    ),
    email: form.email.trim(),
    telefone: form.telefone.trim(),
    endereco: {
      ...form.endereco,
      cep: digits(form.endereco.cep),
      codigoIbge: digits(form.endereco.codigoIbge),
      uf: form.endereco.uf.toUpperCase(),
    },
    habilitaNfe: form.habilitaNfe,
    habilitaNfse: form.habilitaNfse,
    habilitaManifestacao: form.habilitaManifestacao,
    // Só faz sentido com a recepção ligada, e desligar precisa LIMPAR a data:
    // enviá-la junto de `habilitaManifestacao: false` gravaria uma escolha
    // irreversível que ninguém fez.
    dataInicioRecebimento: form.habilitaManifestacao
      ? form.dataInicioRecebimento
      : "",
    padraoNfse: form.padraoNfse,
    serieNfe: optionalNumber(form.serieNfe),
    proximoNumeroNfe: optionalNumber(form.proximoNumeroNfe),
    serieNfse: form.serieNfse.trim(),
    proximoNumeroNfse: optionalNumber(form.proximoNumeroNfse),
    certificadoSenha: form.certificadoSenha || undefined,
  };
}
