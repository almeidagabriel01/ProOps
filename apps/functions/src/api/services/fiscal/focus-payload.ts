/**
 * Domain → Focus NFe mapping.
 *
 * The counterpart of `focus-response.ts`. Together they are the only files
 * that know Focus field names.
 *
 * Field references:
 *  - NF-e:  https://campos.focusnfe.com.br/nfe/NotaFiscalXML.html
 *  - NFS-e: https://campos.focusnfe.com.br/nfse_nacional/EmissaoDPSXml.html
 */

import type {
  FiscalAddress,
  FiscalIeIndicator,
  FiscalInvoiceInput,
  FiscalIssuerConfig,
  FiscalNfsePadrao,
  FiscalProductItem,
} from "./fiscal-types";

/** Default quando o emitente não diz — ver `FiscalNfsePadrao`. */
export function resolveNfsePadrao(
  padrao: FiscalNfsePadrao | undefined,
): FiscalNfsePadrao {
  return padrao === "municipal" ? "municipal" : "nacional";
}

/** `indicador_inscricao_estadual` on the wire: 1 contribuinte, 2 isento, 9 não contribuinte. */
const IE_INDICATOR_CODE: Record<FiscalIeIndicator, number> = {
  contribuinte: 1,
  isento: 2,
  nao_contribuinte: 9,
};

/** Natureza da operação used when the caller does not supply one. */
const DEFAULT_NATUREZA_OPERACAO = "Venda de mercadoria";

function digits(value: string | undefined): string {
  return String(value || "").replace(/\D/g, "");
}

function trimmed(value: string | undefined): string {
  return String(value || "").trim();
}

/** Money and quantities go as plain numbers rounded to the precision the schema accepts. */
function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((Number(value) || 0) * factor) / factor;
}

export interface FocusEmpresaPayload extends Record<string, unknown> {
  nome: string;
  cnpj: string;
  email: string;
  regime_tributario: number;
  logradouro: string;
  numero: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  habilita_nfe: boolean;
  habilita_nfse: boolean;
  habilita_nfsen_producao: boolean;
  habilita_nfsen_homologacao: boolean;
  habilita_manifestacao: boolean;
  arquivo_certificado_base64: string;
  senha_certificado: string;
}

/**
 * `opSimpNac` da DPS nacional: 1 não optante, 2 MEI, 3 ME/EPP.
 *
 * Derivado do CRT que já está no cadastro, em vez de virar mais um campo para o
 * usuário errar — os dois descrevem a mesma coisa por taxonomias diferentes.
 */
function codigoOpcaoSimplesNacional(regimeTributario: number): number {
  if (regimeTributario === 4) return 2; // MEI
  if (regimeTributario === 1 || regimeTributario === 2) return 3; // Simples ME/EPP
  return 1; // Regime Normal
}

/**
 * Builds the issuing-company registration body.
 *
 * The certificate travels here once and is not stored on our side — Focus
 * validates it against the CNPJ and its expiry, and custodies it afterwards.
 */
export function buildEmpresaPayload(issuer: FiscalIssuerConfig): FocusEmpresaPayload {
  const nfsePadrao = resolveNfsePadrao(issuer.padraoNfse);
  const payload: FocusEmpresaPayload = {
    nome: trimmed(issuer.razaoSocial),
    cnpj: digits(issuer.cnpj),
    email: trimmed(issuer.email),
    regime_tributario: issuer.regimeTributario,
    logradouro: trimmed(issuer.endereco.logradouro),
    numero: trimmed(issuer.endereco.numero),
    bairro: trimmed(issuer.endereco.bairro),
    municipio: trimmed(issuer.endereco.municipio),
    uf: trimmed(issuer.endereco.uf).toUpperCase(),
    cep: digits(issuer.endereco.cep),
    habilita_nfe: issuer.habilitaNfe,
    // As duas NFS-e têm flags próprias no cadastro. Enviar as três sempre,
    // inclusive `false`, é o que permite trocar de padrão sem refazer o cadastro.
    habilita_nfse: issuer.habilitaNfse && nfsePadrao === "municipal",
    habilita_nfsen_producao: issuer.habilitaNfse && nfsePadrao === "nacional",
    habilita_nfsen_homologacao: issuer.habilitaNfse && nfsePadrao === "nacional",
    // Enviado sempre, inclusive false: assim o cadastro nao precisa ser
    // refeito quando a recepcao de notas for ligada mais tarde.
    habilita_manifestacao: issuer.habilitaManifestacao === true,
    arquivo_certificado_base64: issuer.certificadoBase64,
    senha_certificado: issuer.certificadoSenha,
  };

  const optional: Record<string, unknown> = {
    nome_fantasia: trimmed(issuer.nomeFantasia),
    inscricao_estadual: trimmed(issuer.inscricaoEstadual),
    inscricao_municipal: trimmed(issuer.inscricaoMunicipal),
    cnae: digits(issuer.cnae),
    complemento: trimmed(issuer.endereco.complemento),
    telefone: digits(issuer.telefone),
    ...(nfsePadrao === "nacional"
      ? {
          serie_nfsen_producao: trimmed(issuer.serieNfse),
          serie_nfsen_homologacao: trimmed(issuer.serieNfse),
        }
      : { serie_nfse_producao: trimmed(issuer.serieNfse) }),
  };
  for (const [key, value] of Object.entries(optional)) {
    if (value) payload[key] = value;
  }

  if (typeof issuer.serieNfe === "number") payload.serie_nfe = issuer.serieNfe;
  if (typeof issuer.proximoNumeroNfe === "number") {
    payload.proximo_numero_nfe = issuer.proximoNumeroNfe;
  }
  if (typeof issuer.proximoNumeroNfse === "number") {
    if (nfsePadrao === "nacional") {
      payload.proximo_numero_nfsen_producao = issuer.proximoNumeroNfse;
      payload.proximo_numero_nfsen_homologacao = issuer.proximoNumeroNfse;
    } else {
      payload.proximo_numero_nfse_producao = issuer.proximoNumeroNfse;
    }
  }

  return payload;
}

function buildRecipientAddress(endereco: FiscalAddress): Record<string, unknown> {
  const address: Record<string, unknown> = {
    logradouro: trimmed(endereco.logradouro),
    numero: trimmed(endereco.numero),
    bairro: trimmed(endereco.bairro),
    municipio: trimmed(endereco.municipio),
    uf: trimmed(endereco.uf).toUpperCase(),
    cep: digits(endereco.cep),
  };

  const codigoIbge = digits(endereco.codigoIbge);
  if (codigoIbge) address.codigo_municipio = codigoIbge;

  const complemento = trimmed(endereco.complemento);
  if (complemento) address.complemento = complemento;

  return address;
}

function buildProductLine(item: FiscalProductItem, index: number): Record<string, unknown> {
  const line: Record<string, unknown> = {
    numero_item: index + 1,
    codigo_produto: trimmed(item.codigo),
    descricao: trimmed(item.descricao),
    codigo_ncm: digits(item.ncm),
    cfop: digits(item.cfop),
    unidade_comercial: trimmed(item.unidadeComercial),
    quantidade_comercial: round(item.quantidade, 4),
    valor_unitario_comercial: round(item.valorUnitario, 10),
    valor_bruto: round(item.valorTotal, 2),
    // The SEFAZ schema keeps commercial and taxable units separate; the ERP has
    // no notion of a distinct taxable unit, so they mirror each other.
    unidade_tributavel: trimmed(item.unidadeComercial),
    quantidade_tributavel: round(item.quantidade, 4),
    valor_unitario_tributavel: round(item.valorUnitario, 10),
    icms_origem: item.origem,
    // Whether the line's value composes the invoice total. Always true here —
    // the ERP has no freight-only or non-composing lines.
    inclui_no_total: 1,
  };

  const cest = digits(item.cest);
  if (cest) line.cest = cest;

  // CST and CSOSN are mutually exclusive: Regime Normal uses one, Simples the other.
  const csosn = trimmed(item.csosn);
  const cstIcms = trimmed(item.cstIcms);
  if (csosn) {
    line.icms_situacao_tributaria = csosn;
  } else if (cstIcms) {
    line.icms_situacao_tributaria = cstIcms;
  }

  if (typeof item.aliquotaIcms === "number") {
    line.icms_aliquota = round(item.aliquotaIcms, 4);
  }

  return line;
}

/**
 * Builds the NF-e body.
 *
 * @throws when the input carries no product lines — an NF-e without items is
 * rejected by the schema, and failing here costs nothing while failing at the
 * SEFAZ may consume a number from the series.
 */
export function buildNfePayload(input: FiscalInvoiceInput): Record<string, unknown> {
  const products = input.products ?? [];
  if (products.length === 0) {
    throw new Error("NFE_SEM_ITENS");
  }

  const { issuer, recipient } = input;
  const recipientDoc = digits(recipient.documento);

  const payload: Record<string, unknown> = {
    natureza_operacao: trimmed(input.naturezaOperacao) || DEFAULT_NATUREZA_OPERACAO,
    data_emissao: input.dataEmissao,
    tipo_documento: 1, // saída
    finalidade_emissao: 1, // normal
    consumidor_final: recipient.consumidorFinal ? 1 : 0,
    presenca_comprador: recipient.consumidorFinal ? 1 : 0,
    cnpj_emitente: digits(issuer.cnpj),
    nome_emitente: trimmed(issuer.razaoSocial),
    logradouro_emitente: trimmed(issuer.endereco.logradouro),
    numero_emitente: trimmed(issuer.endereco.numero),
    bairro_emitente: trimmed(issuer.endereco.bairro),
    municipio_emitente: trimmed(issuer.endereco.municipio),
    uf_emitente: trimmed(issuer.endereco.uf).toUpperCase(),
    cep_emitente: digits(issuer.endereco.cep),
    regime_tributario_emitente: issuer.regimeTributario,
    nome_destinatario: trimmed(recipient.nome),
    indicador_inscricao_estadual_destinatario: IE_INDICATOR_CODE[recipient.indicadorIe],
    valor_total: round(input.valorTotal, 2),
    valor_produtos: round(
      products.reduce((sum, item) => sum + (Number(item.valorTotal) || 0), 0),
      2,
    ),
    modalidade_frete: 9, // sem frete
    items: products.map(buildProductLine),
  };

  // An 11-digit document is a CPF, 14 a CNPJ — they go in different fields.
  if (recipientDoc.length === 11) {
    payload.cpf_destinatario = recipientDoc;
  } else if (recipientDoc.length === 14) {
    payload.cnpj_destinatario = recipientDoc;
  }

  const inscricaoEstadual = trimmed(recipient.inscricaoEstadual);
  // Only an actual ICMS taxpayer may carry an IE. Sending one for an exempt or
  // non-taxpayer recipient is what triggers rejection 805.
  if (inscricaoEstadual && recipient.indicadorIe === "contribuinte") {
    payload.inscricao_estadual_destinatario = inscricaoEstadual;
  }

  if (recipient.endereco) {
    const address = buildRecipientAddress(recipient.endereco);
    payload.logradouro_destinatario = address.logradouro;
    payload.numero_destinatario = address.numero;
    payload.bairro_destinatario = address.bairro;
    payload.municipio_destinatario = address.municipio;
    payload.uf_destinatario = address.uf;
    payload.cep_destinatario = address.cep;
    if (address.complemento) payload.complemento_destinatario = address.complemento;
    if (address.codigo_municipio) {
      payload.codigo_municipio_destinatario = address.codigo_municipio;
    }
  }

  const email = trimmed(recipient.email);
  if (email) payload.email_destinatario = email;

  const telefone = digits(recipient.telefone);
  if (telefone) payload.telefone_destinatario = telefone;

  const observacoes = trimmed(input.observacoes);
  if (observacoes) payload.informacoes_adicionais_contribuinte = observacoes;

  const inscricaoEstadualEmitente = trimmed(issuer.inscricaoEstadual);
  if (inscricaoEstadualEmitente) {
    payload.inscricao_estadual_emitente = inscricaoEstadualEmitente;
  }

  return payload;
}

/**
 * Builds the NFS-e body.
 *
 * @throws when no service line is present.
 */
/**
 * DPS da NFS-e **Nacional** (`POST /v2/nfsen`).
 *
 * Layout completamente diferente do municipal: plano, sem `prestador` /
 * `tomador` / `servico` aninhados, e com o sufixo `_tomador` nos campos do
 * destinatário. Não é capricho do Focus — é o leiaute nacional da DPS.
 *
 * Numeração não vai aqui de propósito. Série e próximo número vivem no cadastro
 * da empresa (`serie_nfsen_*`, `proximo_numero_nfsen_*`), e mandar o número em
 * cada emissão criaria duas fontes da verdade para a sequência — a que mais
 * causa duplicidade.
 */
export function buildNfsenPayload(input: FiscalInvoiceInput): Record<string, unknown> {
  const service = input.service;
  if (!service) {
    throw new Error("NFSE_SEM_SERVICO");
  }

  const codigoTributacaoNacional = trimmed(service.codigoTributacaoNacional);
  if (!codigoTributacaoNacional) {
    // Sem equivalente derivável a partir do item da LC 116: o código nacional
    // tem um desdobro que a lista antiga não carrega. Falhar aqui é melhor que
    // deixar o Ambiente Nacional rejeitar depois de consumir numeração.
    throw new Error("NFSEN_SEM_CODIGO_TRIBUTACAO_NACIONAL");
  }

  const { issuer, recipient } = input;
  const recipientDoc = digits(recipient.documento);
  const municipioEmissor = digits(issuer.endereco.codigoIbge);
  const opcaoSimplesNacional = codigoOpcaoSimplesNacional(issuer.regimeTributario);

  const payload: Record<string, unknown> = {
    data_emissao: input.dataEmissao,
    // Competência é o mês do fato gerador, não do envio. Sem um campo próprio
    // no domínio, a data de emissão é a melhor aproximação e é o que a nota de
    // referência do primeiro emitente também traz.
    data_competencia: String(input.dataEmissao).slice(0, 10),
    codigo_municipio_emissora: Number(municipioEmissor),
    cnpj_prestador: digits(issuer.cnpj),
    codigo_opcao_simples_nacional: opcaoSimplesNacional,
    codigo_municipio_prestacao: municipioEmissor,
    codigo_tributacao_nacional_iss: codigoTributacaoNacional,
    descricao_servico: trimmed(service.descricao),
    valor_servico: round(service.valorServicos, 2),
    // 1 = operação tributável. Imunidade, exportação e não incidência são
    // exceções que dependem do serviço e ainda não temos onde declarar.
    tributacao_iss: 1,
    tipo_retencao_iss: service.issRetido ? 2 : 1,
    percentual_aliquota_relativa_municipio: round(service.aliquotaIss, 4),
    razao_social_tomador: trimmed(recipient.nome),
    // `trib` exige um filho: sem isto o XSD do Ambiente Nacional rejeita com
    // "Element 'trib': Missing child element(s)". 0 = não informar os valores
    // estimados de tributos (Decreto 8.264/2014), que é o que a NFS-e de
    // referência desta empresa também faz.
    indicador_total_tributacao: 0,
  };

  // `regTrib` também exige um filho, e qual deles depende do regime:
  // regApTribSN para quem é do Simples, regEspTrib para o resto. Mandar o
  // errado rejeita igual a não mandar nada.
  if (opcaoSimplesNacional === 1) {
    payload.regime_especial_tributacao = issuer.regimeEspecialTributacao ?? 0;
  } else {
    payload.regime_tributario_simples_nacional =
      issuer.regimeApuracaoSimplesNacional ?? 1;
  }

  if (recipientDoc.length === 11) {
    payload.cpf_tomador = recipientDoc;
  } else if (recipientDoc.length === 14) {
    payload.cnpj_tomador = recipientDoc;
  }

  const nbs = trimmed(service.nbs);
  if (nbs) payload.codigo_nbs = nbs;

  const endereco = recipient.endereco;
  if (endereco) {
    const optional: Record<string, string> = {
      logradouro_tomador: trimmed(endereco.logradouro),
      numero_tomador: trimmed(endereco.numero),
      bairro_tomador: trimmed(endereco.bairro),
      cep_tomador: digits(endereco.cep),
      codigo_municipio_tomador: digits(endereco.codigoIbge),
    };
    for (const [key, value] of Object.entries(optional)) {
      if (value) payload[key] = value;
    }
  }

  const observacoes = trimmed(input.observacoes);
  if (observacoes) payload.informacoes_complementares = observacoes;

  return payload;
}

export function buildNfsePayload(input: FiscalInvoiceInput): Record<string, unknown> {
  const service = input.service;
  if (!service) {
    throw new Error("NFSE_SEM_SERVICO");
  }

  const { issuer, recipient } = input;
  const recipientDoc = digits(recipient.documento);

  const tomador: Record<string, unknown> = {
    razao_social: trimmed(recipient.nome),
  };
  if (recipientDoc.length === 11) {
    tomador.cpf = recipientDoc;
  } else if (recipientDoc.length === 14) {
    tomador.cnpj = recipientDoc;
  }

  const email = trimmed(recipient.email);
  if (email) tomador.email = email;

  if (recipient.endereco) {
    tomador.endereco = buildRecipientAddress(recipient.endereco);
  }

  const servico: Record<string, unknown> = {
    discriminacao: trimmed(service.descricao),
    item_lista_servico: trimmed(service.codigoLc116),
    valor_servicos: round(service.valorServicos, 2),
    aliquota: round(service.aliquotaIss, 4),
    iss_retido: service.issRetido,
  };

  const codigoMunicipio = trimmed(service.codigoTributacaoMunicipio);
  if (codigoMunicipio) servico.codigo_tributario_municipio = codigoMunicipio;

  // NT 007/2026 — in force for the NFS-e Nacional layout since 09/02/2026.
  const nbs = trimmed(service.nbs);
  if (nbs) servico.codigo_nbs = nbs;

  const codigoTributacaoNacional = trimmed(service.codigoTributacaoNacional);
  if (codigoTributacaoNacional) {
    servico.codigo_tributacao_nacional = codigoTributacaoNacional;
  }

  const payload: Record<string, unknown> = {
    data_emissao: input.dataEmissao,
    prestador: {
      cnpj: digits(issuer.cnpj),
      ...(trimmed(issuer.inscricaoMunicipal)
        ? { inscricao_municipal: trimmed(issuer.inscricaoMunicipal) }
        : {}),
      codigo_municipio: digits(issuer.endereco.codigoIbge),
    },
    tomador,
    servico,
  };

  const observacoes = trimmed(input.observacoes);
  if (observacoes) {
    (payload.servico as Record<string, unknown>).outras_informacoes = observacoes;
  }

  return payload;
}

/** Dispatches to the right builder for the document kind. */
export function buildInvoicePayload(input: FiscalInvoiceInput): Record<string, unknown> {
  if (input.type === "nfe") {
    return buildNfePayload(input);
  }

  // A variante mora no emitente, não no tipo do documento — ver `FiscalNfsePadrao`.
  return resolveNfsePadrao(input.issuer.padraoNfse) === "nacional"
    ? buildNfsenPayload(input)
    : buildNfsePayload(input);
}
