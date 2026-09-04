import { callApi } from "@/lib/api-client";

export type FiscalDocumentType = "nfe" | "nfse";

/**
 * Qual padrão de NFS-e o emitente usa. Não é um terceiro tipo de documento —
 * decide o recurso e o layout no provedor, e nada mais no ERP.
 */
export type FiscalNfsePadrao = "nacional" | "municipal";
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

/** Resposta de `previewFromProposal` — o que sairia, sem emitir. */
export interface FiscalIssuePreview {
  canIssue: boolean;
  reason?:
    | "FISCAL_NAO_CONFIGURADO"
    | "FISCAL_NAO_PRONTO"
    | "FISCAL_INCOMPLETO"
    | "PROPOSTA_SEM_CLIENTE";
  gaps: FiscalGap[];
  documentos: Array<{ type: "nfe" | "nfse"; valorTotal: number }>;
  /** Só autorizadas ou em processamento — as outras não são documento válido. */
  jaEmitidas: Array<{
    id: string;
    type: "nfe" | "nfse";
    status: FiscalInvoiceStatus;
    numero?: string;
    serie?: string;
  }>;
}

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
  /**
   * Resultado do registro dos gatilhos de notificação. Falhar aqui não bloqueia
   * o cadastro — mas sem gatilho toda nota depende do cron de 15 minutos, e
   * isso precisa aparecer em vez de ficar só gravado.
   */
  webhookStatus?: {
    state: "registered" | "failed" | "partial";
    attemptedAt: string;
    registered: string[];
    lastError?: string;
  };
  cnpj?: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  inscricaoEstadual?: string;
  inscricaoMunicipal?: string;
  cnae?: string;
  regimeTributario?: FiscalTaxRegime;
  /** `pTotTribSN` — alíquota efetiva do DAS, exigida de ME/EPP na NFS-e. */
  percentualTotalTributosSimplesNacional?: number;
  email?: string;
  telefone?: string;
  endereco?: FiscalAddress;
  habilitaNfe?: boolean;
  habilitaNfse?: boolean;
  /** Recepção de notas de ENTRADA. Nasce desligada — consome pacote do provedor. */
  habilitaManifestacao?: boolean;
  dataInicioRecebimento?: string;
  dataInicioRecebimentoBloqueada?: boolean;
  padraoNfse?: FiscalNfsePadrao;
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
  percentualTotalTributosSimplesNacional?: number;
  email: string;
  telefone?: string;
  endereco: FiscalAddress;
  habilitaNfe: boolean;
  habilitaNfse: boolean;
  habilitaManifestacao?: boolean;
  dataInicioRecebimento?: string;
  padraoNfse?: FiscalNfsePadrao;
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
  /** Derivado das flags do Simples que a Receita devolve. */
  regimeTributario?: FiscalTaxRegime;
  /** `pTotTribSN` — alíquota efetiva do DAS, exigida de ME/EPP na NFS-e. */
  percentualTotalTributosSimplesNacional?: number;
  /** "Ativa", "Baixada", "Suspensa"… CNPJ não ativo não emite. */
  situacaoCadastral?: string;
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

/** Limites do Ajuste SINIEF 07/2005, espelhados do backend. */
export const CORRECTION_TEXT_MIN_LENGTH = 15;
export const CORRECTION_TEXT_MAX_LENGTH = 1000;
/** Teto de eventos por NF-e; passar disso é a rejeição 594. */
export const CORRECTION_MAX_COUNT = 20;

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
  /** Cartas de correção já registradas — a última é a que vale perante o fisco. */
  correcoes?: Array<{ texto: string; registradaEm: string }>;
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

  /**
   * Sai do modo de teste (ou volta). Endpoint próprio, e não um campo do
   * formulário: depois disso toda nota vale juridicamente.
   */
  setEnvironment: (environment: FiscalEnvironment, force = false) =>
    callApi<FiscalSettings>("/v1/fiscal/environment", "PUT", { environment, force }),

  /**
   * Consulta a nota no provedor agora. O cron só olha 15 min depois da emissão,
   * e quem está na tela não deveria precisar abrir o painel do provedor.
   */
  refreshInvoice: (id: string) =>
    callApi<{ invoice: FiscalInvoice }>(`/v1/fiscal/invoices/${id}/refresh`, "POST"),

  lookupCnpj: (cnpj: string) =>
    callApi<CnpjLookup>(`/v1/fiscal/cnpj/${cnpj.replace(/\D/g, "")}`, "GET"),

  /**
   * Envia o certificado A1 ao provedor. O arquivo não é guardado pelo ProOps —
   * quem custodia é o provedor, que valida senha, titularidade do CNPJ e prazo.
   * `dryRun` valida tudo sem persistir.
   */
  /** Reenvia o registro dos gatilhos sem precisar reenviar o certificado. */
  retryWebhooks: () =>
    callApi<FiscalSettings>("/v1/fiscal/webhooks/retry", "POST"),

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

  /**
   * Remove a configuração fiscal do tenant.
   *
   * As notas já emitidas PERMANECEM — documento fiscal tem guarda legal de 5
   * anos e não some com a desconexão. O que se perde é o cadastro do emitente:
   * CNPJ, série, numeração e a senha do certificado cifrada em KMS.
   */
  disconnect: () => callApi<{ message: string }>("/v1/fiscal/settings", "DELETE"),

  /**
   * Pergunta se a nota desta proposta pode sair — sem emitir.
   *
   * Sustenta o convite ao aprovar: sem ele o modal apareceria também para quem
   * ainda não pode emitir, e o atalho terminaria numa checklist de pendências.
   */
  previewFromProposal: (proposalId: string) =>
    callApi<FiscalIssuePreview>(
      `/v1/fiscal/invoices/preview/from-proposal/${proposalId}`,
      "GET",
    ),

  /** Responde 202: a autorização é assíncrona e chega depois. */
  issueInvoice: (payload: IssueInvoicePayload) =>
    callApi<FiscalInvoice>("/v1/fiscal/invoices", "POST", payload),

  /**
   * Emite a partir do documento de negócio — o caminho dos botões.
   *
   * Uma proposta mista devolve **duas notas**: NF-e da mercadoria e NFS-e da
   * mão de obra. Faltando dado fiscal, nenhuma é enviada e o erro traz `gaps`.
   */
  issueFromProposal: (proposalId: string, payload?: { naturezaOperacao?: string }) =>
    callApi<{ invoices: FiscalInvoice[] }>(
      `/v1/fiscal/invoices/from-proposal/${proposalId}`,
      "POST",
      payload ?? {},
    ),

  issueFromTransaction: (transactionId: string) =>
    callApi<{ invoices: FiscalInvoice[] }>(
      `/v1/fiscal/invoices/from-transaction/${transactionId}`,
      "POST",
      {},
    ),

  /**
   * Carta de correção — só NF-e autorizada.
   *
   * **Cumulativa**: a última sobrescreve as anteriores perante o fisco, então o
   * texto enviado precisa conter tudo o que ainda vale.
   */
  correctInvoice: (invoiceId: string, correcao: string) =>
    callApi<FiscalInvoice>(`/v1/fiscal/invoices/${invoiceId}/correction`, "POST", {
      correcao,
    }),

  cancelInvoice: (invoiceId: string, justificativa: string) =>
    callApi<FiscalInvoice>(`/v1/fiscal/invoices/${invoiceId}/cancel`, "POST", {
      justificativa,
    }),
};
