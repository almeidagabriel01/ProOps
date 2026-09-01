/**
 * Tells the user exactly what is missing before a document can be issued.
 *
 * The design decision this file implements: fiscal fields are **optional in the
 * catalogue and required at issue time**. Nobody is forced to stop and classify
 * 200 products before using the ERP; the block happens when it actually
 * matters, and it names every gap at once so the user fixes them in one pass
 * instead of discovering them one rejection at a time.
 *
 * Checking here is also strictly cheaper than checking at the SEFAZ: a rejected
 * NF-e can consume a number from the series, and a rejected note may consume a
 * unit of the provider's monthly package.
 */

import type { FiscalIeIndicator, FiscalNfsePadrao, FiscalTaxRegime } from "./fiscal-types";

/** Where the user has to go to fix the problem. */
export type FiscalGapScope = "emitente" | "cliente" | "produto" | "servico";

export interface FiscalGap {
  scope: FiscalGapScope;
  /** Document id of the offending product/service/client, when applicable. */
  entityId?: string;
  entityName?: string;
  field: string;
  /** Written for an installer, not for an accountant. */
  message: string;
}

export interface IssuerReadinessInput {
  cnpj?: string;
  razaoSocial?: string;
  inscricaoEstadual?: string;
  inscricaoMunicipal?: string;
  regimeTributario?: FiscalTaxRegime;
  percentualTotalTributosSimplesNacional?: number;
  endereco?: {
    logradouro?: string;
    numero?: string;
    bairro?: string;
    municipio?: string;
    codigoIbge?: string;
    uf?: string;
    cep?: string;
  };
}

export interface RecipientReadinessInput {
  id?: string;
  nome?: string;
  documento?: string;
  indicadorIe?: FiscalIeIndicator;
  inscricaoEstadual?: string;
  endereco?: {
    logradouro?: string;
    numero?: string;
    bairro?: string;
    municipio?: string;
    codigoIbge?: string;
    uf?: string;
    cep?: string;
  };
}

export interface ProductReadinessInput {
  id?: string;
  name?: string;
  ncm?: string;
  origem?: number;
}

export interface ServiceReadinessInput {
  id?: string;
  name?: string;
  codigoLc116?: string;
  aliquotaIss?: number;
  codigoTributacaoNacional?: string;
}

function isBlank(value: unknown): boolean {
  return typeof value !== "string" || value.trim() === "";
}

function digitsOf(value: unknown): string {
  return typeof value === "string" ? value.replace(/\D/g, "") : "";
}

/** Gaps that block any document, of either kind. */
export function checkIssuerReadiness(issuer: IssuerReadinessInput): FiscalGap[] {
  const gaps: FiscalGap[] = [];
  const add = (field: string, message: string) =>
    gaps.push({ scope: "emitente", field, message });

  if (digitsOf(issuer.cnpj).length !== 14) {
    add("cnpj", "O CNPJ da sua empresa está ausente ou incompleto.");
  }
  if (isBlank(issuer.razaoSocial)) {
    add("razaoSocial", "Informe a razão social da sua empresa.");
  }
  if (!issuer.regimeTributario) {
    add("regimeTributario", "Selecione o regime tributário da sua empresa.");
  }

  const endereco = issuer.endereco;
  if (!endereco) {
    add("endereco", "Preencha o endereço da sua empresa.");
    return gaps;
  }
  if (isBlank(endereco.logradouro)) add("endereco.logradouro", "Informe o logradouro da sua empresa.");
  if (isBlank(endereco.numero)) add("endereco.numero", "Informe o número do endereço da sua empresa.");
  if (isBlank(endereco.bairro)) add("endereco.bairro", "Informe o bairro da sua empresa.");
  if (isBlank(endereco.municipio)) add("endereco.municipio", "Informe o município da sua empresa.");
  if (digitsOf(endereco.cep).length !== 8) {
    add("endereco.cep", "O CEP da sua empresa deve ter 8 dígitos.");
  }
  if (String(endereco.uf || "").trim().length !== 2) {
    add("endereco.uf", "Informe a UF da sua empresa.");
  }
  if (digitsOf(endereco.codigoIbge).length !== 7) {
    add(
      "endereco.codigoIbge",
      "Falta o código IBGE do município da sua empresa. Ele é preenchido ao buscar o CEP.",
    );
  }

  return gaps;
}

/** Extra issuer requirements that depend on which document is being issued. */
export function checkIssuerReadinessForType(
  issuer: IssuerReadinessInput,
  type: "nfe" | "nfse",
): FiscalGap[] {
  const gaps = checkIssuerReadiness(issuer);

  if (type === "nfe" && isBlank(issuer.inscricaoEstadual)) {
    gaps.push({
      scope: "emitente",
      field: "inscricaoEstadual",
      message: "Informe a inscrição estadual da sua empresa para emitir nota de produto.",
    });
  }

  if (type === "nfse" && isBlank(issuer.inscricaoMunicipal)) {
    gaps.push({
      scope: "emitente",
      field: "inscricaoMunicipal",
      message: "Informe a inscrição municipal da sua empresa para emitir nota de serviço.",
    });
  }

  // ME/EPP do Simples: `totTrib` é obrigatório na DPS e, para esse regime, o
  // único preenchimento aceito é o percentual da alíquota — o indicador de
  // "não informar" é recusado com E0712. Cobrar aqui transforma uma rejeição
  // do fisco, que chega minutos depois e fala em siglas, numa pendência com
  // nome e lugar para resolver. MEI fica de fora: usa o indicador.
  if (
    type === "nfse" &&
    (issuer.regimeTributario === 1 || issuer.regimeTributario === 2) &&
    (issuer.percentualTotalTributosSimplesNacional === undefined ||
      issuer.percentualTotalTributosSimplesNacional === null)
  ) {
    gaps.push({
      scope: "emitente",
      field: "percentualTotalTributosSimplesNacional",
      message:
        "Informe a alíquota aproximada do Simples Nacional da sua empresa — ela sai do seu DAS e é obrigatória na nota de serviço.",
    });
  }

  return gaps;
}

/**
 * Recipient gaps.
 *
 * The address is only mandatory for NF-e — a merchandise document describes a
 * physical delivery, so the SEFAZ validates the destination against its own
 * IBGE table. NFS-e is far more permissive.
 */
export function checkRecipientReadiness(
  recipient: RecipientReadinessInput,
  type: "nfe" | "nfse",
): FiscalGap[] {
  const gaps: FiscalGap[] = [];
  const add = (field: string, message: string) =>
    gaps.push({
      scope: "cliente",
      entityId: recipient.id,
      entityName: recipient.nome,
      field,
      message,
    });

  if (isBlank(recipient.nome)) {
    add("nome", "O cliente precisa de nome ou razão social.");
  }

  const documento = digitsOf(recipient.documento);
  if (documento.length !== 11 && documento.length !== 14) {
    add("documento", "Informe o CPF ou CNPJ do cliente.");
  }

  // Rejection 805: the destination SEFAZ refuses "isento" for a recipient that
  // simply is not an ICMS taxpayer. A natural person is never "isento".
  if (type === "nfe" && documento.length === 11 && recipient.indicadorIe === "isento") {
    add(
      "indicadorIe",
      'Pessoa física não pode ser "isento" de inscrição estadual. Use "não contribuinte".',
    );
  }

  if (
    type === "nfe" &&
    recipient.indicadorIe === "contribuinte" &&
    isBlank(recipient.inscricaoEstadual)
  ) {
    add(
      "inscricaoEstadual",
      'Cliente marcado como contribuinte precisa de inscrição estadual — ou mude para "não contribuinte".',
    );
  }

  if (type !== "nfe") {
    return gaps;
  }

  const endereco = recipient.endereco;
  if (!endereco) {
    add("endereco", "Preencha o endereço do cliente para emitir nota de produto.");
    return gaps;
  }
  if (isBlank(endereco.logradouro)) add("endereco.logradouro", "Informe o logradouro do cliente.");
  if (isBlank(endereco.numero)) add("endereco.numero", "Informe o número do endereço do cliente.");
  if (isBlank(endereco.bairro)) add("endereco.bairro", "Informe o bairro do cliente.");
  if (isBlank(endereco.municipio)) add("endereco.municipio", "Informe o município do cliente.");
  if (digitsOf(endereco.cep).length !== 8) add("endereco.cep", "O CEP do cliente deve ter 8 dígitos.");
  if (String(endereco.uf || "").trim().length !== 2) add("endereco.uf", "Informe a UF do cliente.");
  if (digitsOf(endereco.codigoIbge).length !== 7) {
    add(
      "endereco.codigoIbge",
      "Falta o código IBGE do município do cliente. Ele é preenchido ao buscar o CEP.",
    );
  }

  return gaps;
}

/** NCM is the one field with no default and no derivation. */
export function checkProductReadiness(products: ProductReadinessInput[]): FiscalGap[] {
  const gaps: FiscalGap[] = [];

  for (const product of products) {
    const ncm = digitsOf(product.ncm);
    if (ncm.length !== 8) {
      gaps.push({
        scope: "produto",
        entityId: product.id,
        entityName: product.name,
        field: "ncm",
        message: isBlank(product.ncm)
          ? `Defina o NCM de "${product.name || "produto sem nome"}". Ele costuma vir na nota do fornecedor.`
          : `O NCM de "${product.name || "produto sem nome"}" deve ter 8 dígitos.`,
      });
    }
  }

  return gaps;
}

export function checkServiceReadiness(
  service: ServiceReadinessInput,
  padraoNfse: FiscalNfsePadrao = "nacional",
): FiscalGap[] {
  const gaps: FiscalGap[] = [];
  const add = (field: string, message: string) =>
    gaps.push({
      scope: "servico",
      entityId: service.id,
      entityName: service.name,
      field,
      message,
    });

  if (isBlank(service.codigoLc116)) {
    add(
      "codigoLc116",
      `Defina o código de serviço (LC 116) de "${service.name || "serviço sem nome"}".`,
    );
  }

  if (padraoNfse === "nacional" && isBlank(service.codigoTributacaoNacional)) {
    // Sem derivação a partir do item da LC 116: o código nacional tem um
    // desdobro que a lista antiga não carrega ("Serviços técnicos em eletrônica"
    // é 31.01.02, e o 31.01 sozinho não diz qual desdobro). Barrar aqui é muito
    // melhor que tomar rejeição do Ambiente Nacional depois de consumir número.
    add(
      "codigoTributacaoNacional",
      `Defina o código de tributação nacional de "${service.name || "serviço sem nome"}" (ex.: 310102). Ele aparece na NFS-e que a empresa já emite.`,
    );
  }

  // Zero is a valid ISS rate for a few municipalities and regimes, so only an
  // absent or out-of-range value is a gap.
  const aliquota = service.aliquotaIss;
  if (typeof aliquota !== "number" || Number.isNaN(aliquota) || aliquota < 0 || aliquota > 100) {
    add("aliquotaIss", "Informe a alíquota de ISS do município (normalmente entre 2% e 5%).");
  }

  return gaps;
}

export interface ReadinessReport {
  ready: boolean;
  gaps: FiscalGap[];
}

/**
 * The single pre-issue gate.
 *
 * Collects every gap rather than stopping at the first, so the UI can show one
 * complete checklist. Ordered emitente → cliente → itens, which is the order
 * the user can actually fix them in.
 */
export function checkIssueReadiness(input: {
  type: "nfe" | "nfse";
  issuer: IssuerReadinessInput;
  recipient: RecipientReadinessInput;
  products?: ProductReadinessInput[];
  service?: ServiceReadinessInput;
  /** Default `nacional` — ver `FiscalNfsePadrao`. */
  padraoNfse?: FiscalNfsePadrao;
}): ReadinessReport {
  const gaps: FiscalGap[] = [
    ...checkIssuerReadinessForType(input.issuer, input.type),
    ...checkRecipientReadiness(input.recipient, input.type),
  ];

  if (input.type === "nfe") {
    const products = input.products ?? [];
    if (products.length === 0) {
      gaps.push({
        scope: "produto",
        field: "items",
        message: "A nota de produto precisa de ao menos um item.",
      });
    }
    gaps.push(...checkProductReadiness(products));
  } else if (input.service) {
    gaps.push(...checkServiceReadiness(input.service, input.padraoNfse ?? "nacional"));
  } else {
    gaps.push({
      scope: "servico",
      field: "servico",
      message: "A nota de serviço precisa de um serviço descrito.",
    });
  }

  return { ready: gaps.length === 0, gaps };
}
