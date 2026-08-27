/**
 * The contract every fiscal provider implements.
 *
 * This exists because fiscal providers disappear: Nuvem Fiscal — the obvious
 * pay-per-use choice for this module — was shut down on 31/07/2026 with 90
 * days' notice. Domain code depends on this interface only, so replacing a
 * provider is a registry entry plus one implementation, never a rewrite of the
 * fiscal module under legal-deadline pressure.
 */

import type {
  FiscalDocumentType,
  FiscalEnvironment,
  FiscalInvoiceInput,
  FiscalInvoiceResult,
  FiscalIssuerConfig,
  FiscalIssuerResult,
} from "./fiscal-types";

export type FiscalProviderId = "focus" | "asaas" | "govbr";

/** Which document kinds a provider can actually produce. */
export interface FiscalProviderCapabilities {
  nfe: boolean;
  nfse: boolean;
  nfce: boolean;
}

/** Public company data, used to prefill the issuer wizard from a CNPJ alone. */
export interface FiscalCnpjLookup {
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

export interface FiscalProvider {
  readonly id: FiscalProviderId;
  readonly capabilities: FiscalProviderCapabilities;

  /** Whether this provider can issue the given document kind at all. */
  supports(type: FiscalDocumentType): boolean;

  /**
   * Registers or updates the issuing company, including its A1 certificate.
   * Idempotent by CNPJ — calling it again updates rather than duplicating.
   */
  /**
   * Cadastra (ou atualiza — o provedor indexa por CNPJ) a empresa emitente.
   *
   * `dryRun` exercita toda a validação — senha do certificado, titularidade do
   * CNPJ, prazo de validade — **sem persistir**. Faz parte da interface, e não
   * só da implementação: sem estar declarada aqui, ninguém conseguia passá-la,
   * e o controller lia o campo do request para depois descartá-lo — criando a
   * empresa de verdade num pedido que só queria validar.
   */
  registerIssuer(
    issuer: FiscalIssuerConfig,
    env: FiscalEnvironment,
    dryRun?: boolean,
  ): Promise<FiscalIssuerResult>;

  lookupCnpj(cnpj: string, env: FiscalEnvironment): Promise<FiscalCnpjLookup>;

  /**
   * Sends a document for authorization.
   *
   * Issuing is asynchronous: the provider validates the payload synchronously
   * and rejects malformed input right away, then queues the document for the
   * SEFAZ or the municipality. A `processing` result is the normal path — the
   * webhook or the retry cron settles it.
   */
  issue(
    input: FiscalInvoiceInput,
    env: FiscalEnvironment,
    token: string,
  ): Promise<FiscalInvoiceResult>;

  consult(
    ref: string,
    type: FiscalDocumentType,
    env: FiscalEnvironment,
    token: string,
  ): Promise<FiscalInvoiceResult>;

  /**
   * Cancels an authorized document.
   *
   * The window is set by the authority, not by us: 24h in most states for NF-e
   * (up to 168h in some), and per-municipality for NFS-e. Outside it the
   * provider refuses and the correct move is a return/replacement document.
   */
  cancel(
    ref: string,
    type: FiscalDocumentType,
    justificativa: string,
    env: FiscalEnvironment,
    token: string,
  ): Promise<FiscalInvoiceResult>;

  /**
   * Carta de Correção Eletrônica — NF-e only.
   *
   * Cannot change values, recipient CNPJ, NCM, CFOP, or invoice/duplicata data;
   * for those the document must be cancelled and reissued. NFS-e has no CC-e at
   * all — the municipal mechanism is cancel-and-replace.
   */
  correct?(
    ref: string,
    texto: string,
    env: FiscalEnvironment,
    token: string,
  ): Promise<FiscalInvoiceResult>;

  /**
   * Asks the provider to replay its notification to the registered webhooks.
   * Recovers a dropped event without re-issuing anything.
   */
  replayNotification?(
    ref: string,
    type: FiscalDocumentType,
    env: FiscalEnvironment,
    token: string,
  ): Promise<void>;
}

/** Minimum justification length the SEFAZ accepts on a cancellation. */
export const CANCELLATION_JUSTIFICATION_MIN_LENGTH = 15;
export const CANCELLATION_JUSTIFICATION_MAX_LENGTH = 255;

/** CC-e text bounds, per Ajuste SINIEF 07/2005. */
export const CORRECTION_TEXT_MIN_LENGTH = 15;
export const CORRECTION_TEXT_MAX_LENGTH = 1000;
