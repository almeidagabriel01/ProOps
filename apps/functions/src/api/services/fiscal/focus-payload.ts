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

import { brasiliaDatePart } from "./fiscal-datetime";
import { sanitizeFiscalText } from "./fiscal-text";
import { resolveIpi, totalIpi } from "./nfe-extras";
import type {
  FiscalAddress,
  FiscalIeIndicator,
  FiscalInvoiceInput,
  FiscalIssuerConfig,
  FiscalEnvironment,
  FiscalNfsePadrao,
  FiscalPisCofins,
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

/**
 * Literal que a SEFAZ exige no nome do destinatário em HOMOLOGAÇÃO.
 *
 * NT 2011/002, obrigatório desde 01/05/2011: qualquer outro valor devolve a
 * rejeição **598**. É uma regra que só existe no ambiente de teste — e por isso
 * mesmo nunca apareceria em produção, o que a torna fácil de esquecer.
 *
 * Sem acento, com o hífen cercado de espaços, exatamente como está na norma.
 */
const HOMOLOGACAO_NOME_DESTINATARIO =
  "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL";

/** Natureza da operação used when the caller does not supply one. */
const DEFAULT_NATUREZA_OPERACAO = "Venda de mercadoria";

function digits(value: string | undefined): string {
  return String(value || "").replace(/\D/g, "");
}

/**
 * Todo texto que sai daqui passa pelo saneamento do XSD (U+0020 a U+00FF).
 *
 * E o mesmo defeito que recusou a primeira carta de correcao real, e ele nao e
 * exclusivo da CC-e: descricao de item, nome do destinatario e informacoes
 * adicionais aceitam o que o usuario digitar, e um produto chamado
 * "Cortina Blackout — 2,40m" derrubaria a nota inteira com a mesma mensagem
 * ilegivel de schema.
 *
 * Sanear neste ponto cobre todos os campos de uma vez. Para os que ja sao
 * codigo (CFOP, UF, unidade, item da LC 116) e no-op — sao ASCII por
 * construcao.
 */
function trimmed(value: string | undefined): string {
  return sanitizeFiscalText(String(value || ""));
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
  habilita_manifestacao_homologacao: boolean;
  data_inicio_recebimento_nfe?: string;
  arquivo_certificado_base64: string;
  senha_certificado: string;
}

/**
 * `opSimpNac` da DPS nacional: 1 não optante, 2 MEI, 3 ME/EPP.
 *
 * Derivado do CRT que já está no cadastro, em vez de virar mais um campo para o
 * usuário errar — os dois descrevem a mesma coisa por taxonomias diferentes.
 */
/**
 * Série da DPS nacional com 5 dígitos.
 *
 * O leiaute define `Integer[5]` e documenta a faixa como `00001 a 49999`. Como
 * é inteiro, `1` e `00001` são o mesmo valor — mas o próprio Ambiente Nacional
 * monta o `idDPS` com cinco posições, e normalizar aqui poupa uma rodada de
 * rejeição a quem digitou o número puro.
 *
 * Só vale para o padrão NACIONAL: a NFS-e municipal aceita série alfanumérica
 * em várias prefeituras, e completar "A1" com zeros a quebraria.
 */
function serieNfsenPadronizada(serie: string | undefined): string {
  const texto = trimmed(serie);
  if (!texto || !/^\d+$/.test(texto)) return texto;
  return texto.padStart(5, "0");
}

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
    // Os DOIS ambientes, mesma regra dos `habilita_nfsen_*`: o provedor separa
    // recepção de produção e de homologação, e mandar só a de produção deixa
    // um emitente em homologação sem receber nada — sem erro em lugar nenhum.
    habilita_manifestacao: issuer.habilitaManifestacao === true,
    habilita_manifestacao_homologacao: issuer.habilitaManifestacao === true,
    // Só quando existe: em branco o provedor puxa TODO o histórico disponível e
    // cobra por nota. Mandar uma data vazia não é neutro.
    ...(issuer.dataInicioRecebimento
      ? { data_inicio_recebimento_nfe: issuer.dataInicioRecebimento }
      : {}),
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
          serie_nfsen_producao: serieNfsenPadronizada(issuer.serieNfse),
          serie_nfsen_homologacao: serieNfsenPadronizada(issuer.serieNfse),
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

function applyPisCofins(
  line: Record<string, unknown>,
  prefix: "pis" | "cofins",
  tax: FiscalPisCofins,
): void {
  line[`${prefix}_situacao_tributaria`] = trimmed(tax.cst);
  if (tax.baseCalculo === undefined) return;
  line[`${prefix}_base_calculo`] = round(tax.baseCalculo, 2);
  line[`${prefix}_aliquota_porcentual`] = round(tax.aliquota ?? 0, 4);
  line[`${prefix}_valor`] = round(tax.valor ?? 0, 2);
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

  // CST (Regime Normal) e CSOSN (Simples) vão no mesmo campo. Os valores já
  // chegam calculados (`line-taxes.ts`) e só existem quando o código os aceita.
  const icms = item.icms;
  line.icms_situacao_tributaria = trimmed(icms.situacao);
  if (icms.baseCalculo !== undefined) {
    // 3 = valor da operação, a única modalidade que a nota oferece.
    line.icms_modalidade_base_calculo = 3;
    line.icms_base_calculo = round(icms.baseCalculo, 2);
    line.icms_aliquota = round(icms.aliquota ?? 0, 4);
    line.icms_valor = round(icms.valor ?? 0, 2);
    if (icms.reducaoBase !== undefined) {
      line.icms_reducao_base_calculo = round(icms.reducaoBase, 4);
    }
  }
  if (icms.aliquotaCredito !== undefined) {
    line.icms_aliquota_credito_simples = round(icms.aliquotaCredito, 4);
    line.icms_valor_credito_simples = round(icms.valorCredito ?? 0, 2);
  }

  // A NF-e 4.00 exige os grupos PIS e COFINS em todo item — sem eles a SEFAZ
  // rejeita com 745. O padrão do Simples é 99 zerado (recolhimento no DAS);
  // CST não tributado (04 a 09) vai só com o código.
  applyPisCofins(line, "pis", item.pis);
  applyPisCofins(line, "cofins", item.cofins);

  // O grupo do XML (IPITrib ou IPINT) sai do CST no provedor; base, alíquota e
  // valor só existem no tributado.
  if (item.ipi) {
    const ipi = resolveIpi(item.ipi, item.valorTotal);
    line.ipi_situacao_tributaria = ipi.cst;
    line.ipi_codigo_enquadramento_legal = ipi.codigoEnquadramento;
    if (ipi.baseCalculo !== undefined) {
      line.ipi_base_calculo = round(ipi.baseCalculo, 2);
      line.ipi_aliquota = round(ipi.aliquota ?? 0, 4);
      line.ipi_valor = round(ipi.valor ?? 0, 2);
    }
  }

  return line;
}

/** O bloco de transporte do DANFE. Sem `transporte`, "sem frete" como sempre. */
function applyTransporte(payload: Record<string, unknown>, input: FiscalInvoiceInput): void {
  const transporte = input.transporte;
  payload.modalidade_frete = transporte?.modalidadeFrete ?? 9;
  if (!transporte) return;

  const carrier = transporte.transportadora;
  if (carrier && trimmed(carrier.nome)) {
    payload.nome_transportador = trimmed(carrier.nome);
    const doc = digits(carrier.documento);
    if (doc.length === 14) payload.cnpj_transportador = doc;
    if (doc.length === 11) payload.cpf_transportador = doc;
    const ie = trimmed(carrier.inscricaoEstadual);
    if (ie) payload.inscricao_estadual_transportador = ie;
    const endereco = trimmed(carrier.endereco);
    if (endereco) payload.endereco_transportador = endereco;
    const municipio = trimmed(carrier.municipio);
    if (municipio) payload.municipio_transportador = municipio;
    const uf = trimmed(carrier.uf).toUpperCase();
    if (uf) payload.uf_transportador = uf;
  }

  const volumes = (transporte.volumes ?? [])
    .map((volume) => {
      const out: Record<string, unknown> = {};
      if (volume.quantidade) out.quantidade = Math.round(volume.quantidade);
      if (trimmed(volume.especie)) out.especie = trimmed(volume.especie);
      if (trimmed(volume.marca)) out.marca = trimmed(volume.marca);
      if (trimmed(volume.numeracao)) out.numeracao = trimmed(volume.numeracao);
      if (volume.pesoBruto) out.peso_bruto = round(volume.pesoBruto, 3);
      if (volume.pesoLiquido) out.peso_liquido = round(volume.pesoLiquido, 3);
      return out;
    })
    .filter((volume) => Object.keys(volume).length > 0);
  if (volumes.length > 0) payload.volumes = volumes;
}

/**
 * Builds the NF-e body.
 *
 * @throws when the input carries no product lines — an NF-e without items is
 * rejected by the schema, and failing here costs nothing while failing at the
 * SEFAZ may consume a number from the series.
 */
export function buildNfePayload(
  input: FiscalInvoiceInput,
  env: FiscalEnvironment = "producao",
): Record<string, unknown> {
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
    // 1 normal, 4 devolução. A devolução exige a chave da nota devolvida.
    finalidade_emissao: input.finalidade === "devolucao" ? 4 : 1,
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
    // Em homologação o nome REAL do destinatário é rejeitado (598). O da nota
    // não é o do cliente — é o literal da norma.
    nome_destinatario:
      env === "homologacao"
        ? HOMOLOGACAO_NOME_DESTINATARIO
        : trimmed(recipient.nome),
    indicador_inscricao_estadual_destinatario: IE_INDICATOR_CODE[recipient.indicadorIe],
    valor_total: round(input.valorTotal, 2),
    valor_produtos: round(
      products.reduce((sum, item) => sum + (Number(item.valorTotal) || 0), 0),
      2,
    ),
    items: products.map(buildProductLine),
  };

  applyTransporte(payload, input);

  // O total da nota é produtos + IPI; o chamador já soma (`valorTotal`), e o
  // total do grupo vai explícito para a SEFAZ conferir com as linhas.
  const ipi = totalIpi(products);
  if (products.some((item) => item.ipi)) payload.valor_ipi = ipi;

  const chaves = (input.notasReferenciadas ?? []).map(digits).filter((chave) => chave.length === 44);
  if (chaves.length > 0) {
    payload.notas_referenciadas = chaves.map((chave) => ({ chave_nfe: chave }));
  }

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

  // A mensagem legal vem depois do texto da pessoa e nunca depende dele: a
  // observação se reescreve inteira na tela, a mensagem do crédito não.
  const complementares = [input.observacoes, ...(input.mensagensLegais ?? [])]
    .map((parte) => trimmed(parte))
    .filter(Boolean)
    .join(" | ");
  if (complementares) payload.informacoes_adicionais_contribuinte = complementares;

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
    // Data no fuso de Brasília: `slice(0, 10)` de um ISO em UTC jogaria a
    // competência para o dia seguinte em toda nota emitida depois das 21h.
    data_competencia: brasiliaDatePart(input.dataEmissao),
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
  };

  // `regTrib` é uma SEQUÊNCIA, não uma escolha: opSimpNac, depois regApTribSN
  // (só para optante do Simples) e depois regEspTrib — este último obrigatório
  // sempre, mesmo para quem é do Simples e não tem regime especial nenhum.
  //
  // A primeira rejeição real dizia "Expected is one of ( regApTribSN,
  // regEspTrib )", o que parecia uma alternativa. Depois que regApTribSN passou
  // a ser enviado, a mensagem virou "Expected is ( regEspTrib )" — o validador
  // parou de oferecer a primeira porque ela já tinha sido aceita, e cobrou a
  // segunda. É assim que se lê esse XSD: ele nomeia o próximo elemento
  // esperado, não o conjunto do que falta.
  payload.regime_especial_tributacao = issuer.regimeEspecialTributacao ?? 0;

  if (opcaoSimplesNacional !== 1) {
    payload.regime_tributario_simples_nacional =
      issuer.regimeApuracaoSimplesNacional ?? 1;
  }

  // Exigida quando o município registra essa condição no CNC da NFS-e — a
  // rejeição **E0116** ("a IM deve ser informada para o emitente prestador")
  // é o município dizendo isso, e a regra varia de prefeitura para prefeitura.
  // Mandar sempre que existir é mais barato que descobrir onde é obrigatória.
  // `totTrib` é um CHOICE e um filho OBRIGATÓRIO de `trib` — sem exatamente um
  // deles o XSD rejeita com "Element 'trib': Missing child element(s)". As
  // opções são `vTotTrib`, `pTotTrib`, `indTotTrib` e `pTotTribSN`, e qual vale
  // depende da opção pelo Simples:
  //
  //   ME/EPP (3)       `pTotTribSN`. O indicador é PROIBIDO — rejeição E0712.
  //   Não optante (1)  `indTotTrib`. Ali o `pTotTribSN` é que é proibido (E0713).
  //   MEI (2)          mantém o indicador; não testado, e mudar no escuro seria
  //                    trocar um caso que funciona por um palpite.
  //
  // O indicador significa "opto por não informar os tributos estimados"
  // (Decreto 8.264/2014). Essa porta existe para os demais e está fechada para
  // ME/EPP, que precisa declarar a alíquota efetiva do Simples.
  if (opcaoSimplesNacional === 3) {
    const percentual = issuer.percentualTotalTributosSimplesNacional;
    if (percentual === undefined || percentual === null) {
      throw new Error("NFSEN_SEM_PERCENTUAL_SIMPLES_NACIONAL");
    }
    payload.percentual_total_tributos_simples_nacional = round(percentual, 2);
  } else {
    payload.indicador_total_tributacao = 0;
  }

  const inscricaoMunicipal = trimmed(issuer.inscricaoMunicipal);
  if (inscricaoMunicipal) {
    payload.inscricao_municipal_prestador = inscricaoMunicipal;
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
export function buildInvoicePayload(
  input: FiscalInvoiceInput,
  env: FiscalEnvironment = "producao",
): Record<string, unknown> {
  if (input.type === "nfe") {
    return buildNfePayload(input, env);
  }

  // A variante mora no emitente, não no tipo do documento — ver `FiscalNfsePadrao`.
  return resolveNfsePadrao(input.issuer.padraoNfse) === "nacional"
    ? buildNfsenPayload(input)
    : buildNfsePayload(input);
}
