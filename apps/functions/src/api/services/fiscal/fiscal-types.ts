/**
 * Provider-agnostic domain types for fiscal document issuing.
 *
 * Nothing here mentions a specific provider. The Focus NFe shapes live in
 * `focus-payload.ts` (outbound) and `focus-response.ts` (inbound); swapping
 * providers means writing a new pair of those, not touching this file.
 */

/** Fiscal document kinds the ERP issues. NF-e is state (ICMS), NFS-e is municipal (ISS). */
export type FiscalDocumentType = "nfe" | "nfse";

export type FiscalEnvironment = "homologacao" | "producao";

/**
 * Lifecycle of an invoice in our own storage.
 *
 * `draft` never left the ERP. Everything from `processing` on mirrors a state
 * the provider reported, so a status regression (a late webhook arriving after
 * a newer one) is detectable — see `isTerminalInvoiceStatus`.
 */
export type FiscalInvoiceStatus =
  | "draft"
  | "processing"
  | "authorized"
  | "rejected"
  | "cancelled"
  | "error";

/** CRT — Código de Regime Tributário, as the SEFAZ defines it. */
export type FiscalTaxRegime =
  | 1 // Simples Nacional
  | 2 // Simples Nacional — excesso de sublimite de receita bruta
  | 3 // Regime Normal (Lucro Presumido / Lucro Real)
  | 4; // MEI

/**
 * Indicador de Inscrição Estadual do destinatário.
 *
 * Getting this wrong is the single most common NF-e rejection (código 805):
 * the destination SEFAZ refuses "isento" for recipients that are simply not
 * ICMS taxpayers. A natural person is `nao_contribuinte`, never `isento`.
 */
export type FiscalIeIndicator = "contribuinte" | "isento" | "nao_contribuinte";

export interface FiscalAddress {
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  municipio: string;
  /** 7-digit IBGE municipality code. Mandatory on the wire, not derivable from the name. */
  codigoIbge: string;
  uf: string;
  cep: string;
}

/** The company issuing the document — a ProOps tenant, never ProOps itself. */
export interface FiscalIssuerConfig {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  inscricaoEstadual?: string;
  inscricaoMunicipal?: string;
  cnae?: string;
  regimeTributario: FiscalTaxRegime;
  email: string;
  telefone?: string;
  endereco: FiscalAddress;
  /** A1 certificate (.pfx/.p12) in base64. Never persisted by us — forwarded and dropped. */
  certificadoBase64: string;
  certificadoSenha: string;
  habilitaNfe: boolean;
  habilitaNfse: boolean;
  serieNfe?: number;
  proximoNumeroNfe?: number;
  serieNfse?: string;
  proximoNumeroNfse?: number;
}

/** Who receives the document. */
export interface FiscalRecipient {
  /** CPF (11) or CNPJ (14), digits only. */
  documento: string;
  nome: string;
  email?: string;
  telefone?: string;
  inscricaoEstadual?: string;
  indicadorIe: FiscalIeIndicator;
  /** Drives IBS/CBS credit rules from 2027 and some ICMS scenarios today. */
  consumidorFinal: boolean;
  endereco?: FiscalAddress;
}

/** A merchandise line. Everything here is required by the SEFAZ, not by us. */
export interface FiscalProductItem {
  codigo: string;
  descricao: string;
  /** 8-digit NCM. Also drives `cClassTrib` for IBS/CBS from 2027. */
  ncm: string;
  cest?: string;
  /** Depends on origin and destination UF, so it belongs to the operation, not the product. */
  cfop: string;
  /** 0–8: national, direct import, acquired domestically from an importer, etc. */
  origem: number;
  unidadeComercial: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  /** Regime Normal uses CST; Simples Nacional uses CSOSN. Exactly one applies. */
  cstIcms?: string;
  csosn?: string;
  aliquotaIcms?: number;
}

/** A service line. ISS is municipal, so the rate travels with the item. */
export interface FiscalServiceItem {
  descricao: string;
  /** Item da lista da LC 116/2003, e.g. "7.02", "14.06". */
  codigoLc116: string;
  /** Municipal code, when the city keeps its own list alongside the federal one. */
  codigoTributacaoMunicipio?: string;
  valorServicos: number;
  aliquotaIss: number;
  issRetido: boolean;
  /** NT 007/2026 — required on the NFS-e Nacional layout since 09/02/2026. */
  nbs?: string;
  codigoTributacaoNacional?: string;
}

export interface FiscalInvoiceInput {
  type: FiscalDocumentType;
  /** Our own reference, echoed back by the provider. The idempotency key. */
  ref: string;
  issuer: FiscalIssuerConfig;
  recipient: FiscalRecipient;
  /** Present when `type === "nfe"`. */
  products?: FiscalProductItem[];
  /** Present when `type === "nfse"`. */
  service?: FiscalServiceItem;
  naturezaOperacao?: string;
  observacoes?: string;
  dataEmissao: string;
  valorTotal: number;
}

/** Normalized result, identical in shape whichever provider produced it. */
export interface FiscalInvoiceResult {
  ref: string;
  status: FiscalInvoiceStatus;
  type: FiscalDocumentType;
  numero?: string;
  serie?: string;
  /** NF-e only — the 44-digit access key. */
  chaveAcesso?: string;
  /** NF-e only. */
  protocolo?: string;
  /** NFS-e only. */
  codigoVerificacao?: string;
  /** Provider-hosted PDF (DANFE or DANFSe). Mirrored to our Storage once authorized. */
  pdfUrl?: string;
  xmlUrl?: string;
  /** Public verification page, when the municipality exposes one. */
  publicUrl?: string;
  /** Raw provider/SEFAZ code, kept for the humanized error dictionary. */
  rejectionCode?: string;
  rejectionMessage?: string;
}

export interface FiscalIssuerResult {
  providerIssuerId?: string;
  cnpj: string;
  habilitaNfe: boolean;
  habilitaNfse: boolean;
  /**
   * Credentials the provider mints for this company, one per environment.
   *
   * Issuing uses these, never the account-level token — so a bug cannot emit
   * under another tenant's CNPJ. Stored KMS-encrypted; absent on a dry run,
   * which does not create the company.
   */
  tokenHomologacao?: string;
  tokenProducao?: string;
}

/**
 * A status no later event may move away from.
 *
 * Provider webhooks are not ordered. Without this guard a delayed
 * `processando_autorizacao` can arrive after `autorizado` and walk an
 * authorized invoice backwards.
 */
export function isTerminalInvoiceStatus(status: FiscalInvoiceStatus): boolean {
  return status === "authorized" || status === "cancelled" || status === "rejected";
}
