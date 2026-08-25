import { callApi } from "@/lib/api-client";

export type FiscalDocumentType = "nfe" | "nfse";
export type FiscalEnvironment = "homologacao" | "producao";
export type FiscalSetupStatus = "pending" | "registered" | "ready" | "error";
export type FiscalAutoIssueRule = "manual" | "on_payment" | "on_proposal_approved";

/** CRT — 1 Simples, 2 Simples excesso, 3 Regime Normal, 4 MEI. */
export type FiscalTaxRegime = 1 | 2 | 3 | 4;

export type FiscalInvoiceStatus =
  | "draft"
  | "processing"
  | "authorized"
  | "rejected"
  | "cancelled"
  | "error";

export interface FiscalAddress {
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  municipio: string;
  /** 7 dígitos. Preenchido pela busca de CEP. */
  codigoIbge: string;
  uf: string;
  cep: string;
}

export interface FiscalSettings {
  configured: boolean;
  provider?: string;
  environment?: FiscalEnvironment;
  status?: FiscalSetupStatus;
  cnpj?: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  inscricaoEstadual?: string;
  inscricaoMunicipal?: string;
  cnae?: string;
  regimeTributario?: FiscalTaxRegime;
  email?: string;
  telefone?: string;
  endereco?: FiscalAddress;
  habilitaNfe?: boolean;
  habilitaNfse?: boolean;
  serieNfe?: number;
  proximoNumeroNfe?: number;
  serieNfse?: string;
  proximoNumeroNfse?: number;
  /** Se há senha de certificado guardada — nunca o valor. */
  certificadoArmazenado?: boolean;
  certificadoValidade?: string;
  /** Dias até o certificado A1 vencer; negativo quando já venceu. */
  certificadoDiasParaVencer?: number;
  autoIssueRule?: FiscalAutoIssueRule;
  defaultNaturezaOperacao?: string;
  lastError?: string;
  updatedAt?: string;
}

export interface SaveFiscalSettingsPayload {
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
  habilitaNfe: boolean;
  habilitaNfse: boolean;
  environment?: FiscalEnvironment;
  serieNfe?: number;
  proximoNumeroNfe?: number;
  serieNfse?: string;
  proximoNumeroNfse?: number;
  certificadoValidade?: string;
  certificadoSenha?: string;
  autoIssueRule?: FiscalAutoIssueRule;
}

export interface CnpjLookup {
  cnpj: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  cnae?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  codigoIbge?: string;
  uf?: string;
  cep?: string;
}

/** Onde o usuário tem que ir para resolver a pendência. */
export type FiscalGapScope = "emitente" | "cliente" | "produto" | "servico";

export interface FiscalGap {
  scope: FiscalGapScope;
  entityId?: string;
  entityName?: string;
  field: string;
  message: string;
}

export interface FiscalInvoice {
  id: string;
  tenantId: string;
  ref: string;
  type: FiscalDocumentType;
  status: FiscalInvoiceStatus;
  numero?: string;
  serie?: string;
  chaveAcesso?: string;
  protocolo?: string;
  codigoVerificacao?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  publicUrl?: string;
  valorTotal: number;
  clientId?: string;
  clientName?: string;
  transactionId?: string;
  proposalId?: string;
  rejectionCode?: string;
  rejectionMessage?: string;
  createdAt: string;
  updatedAt: string;
  authorizedAt?: string;
  cancelledAt?: string;
}

export interface NcmSuggestion {
  ncm: string;
  descricao: string;
  /** 0 a 1. */
  confianca: number;
}

export interface IssueInvoicePayload {
  type: FiscalDocumentType;
  valorTotal: number;
  recipient: Record<string, unknown>;
  products?: Array<Record<string, unknown>>;
  service?: Record<string, unknown>;
  naturezaOperacao?: string;
  observacoes?: string;
  transactionId?: string;
  proposalId?: string;
}

export const FiscalService = {
  getSettings: () => callApi<FiscalSettings>("/v1/fiscal/settings", "GET"),

  saveSettings: (payload: SaveFiscalSettingsPayload) =>
    callApi<FiscalSettings>("/v1/fiscal/settings", "PUT", payload),

  lookupCnpj: (cnpj: string) =>
    callApi<CnpjLookup>(`/v1/fiscal/cnpj/${cnpj.replace(/\D/g, "")}`, "GET"),

  /**
   * Envia o certificado A1 ao provedor. O arquivo não é guardado pelo ProOps —
   * quem custodia é o provedor, que valida senha, titularidade do CNPJ e prazo.
   * `dryRun` valida tudo sem persistir.
   */
  registerIssuer: (payload: {
    certificadoBase64: string;
    certificadoSenha?: string;
    dryRun?: boolean;
  }) => callApi<{ providerIssuerId?: string; cnpj: string }>("/v1/fiscal/issuer", "POST", payload),

  suggestNcm: (payload: {
    nome: string;
    descricao?: string;
    categoria?: string;
    fabricante?: string;
  }) =>
    callApi<{ suggestions: NcmSuggestion[] }>("/v1/fiscal/ncm-suggestions", "POST", payload),

  listInvoices: (params?: { limit?: number; status?: FiscalInvoiceStatus }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.status) query.set("status", params.status);
    const suffix = query.toString() ? `?${query}` : "";
    return callApi<{ invoices: FiscalInvoice[] }>(`/v1/fiscal/invoices${suffix}`, "GET");
  },

  /** Responde 202: a autorização é assíncrona e chega depois. */
  issueInvoice: (payload: IssueInvoicePayload) =>
    callApi<FiscalInvoice>("/v1/fiscal/invoices", "POST", payload),

  cancelInvoice: (invoiceId: string, justificativa: string) =>
    callApi<FiscalInvoice>(`/v1/fiscal/invoices/${invoiceId}/cancel`, "POST", {
      justificativa,
    }),
};
