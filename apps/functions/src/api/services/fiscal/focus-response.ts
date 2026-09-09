/**
 * Focus NFe → domain mapping.
 *
 * Every field name the provider owns is confined to this file and to
 * `focus-payload.ts`. Built against the documented API without a live account,
 * so the first real call may surface a field mismatch — keeping the mapping in
 * one place makes that a localized fix instead of a hunt.
 *
 * Field references:
 *  - NF-e:  https://campos.focusnfe.com.br/nfe/NotaFiscalXML.html
 *  - NFS-e: https://campos.focusnfe.com.br/nfse_nacional/EmissaoDPSXml.html
 */

import type {
  FiscalDocumentType,
  FiscalInvoiceResult,
  FiscalInvoiceStatus,
} from "./fiscal-types";

/**
 * Status vocabulary Focus reports. Identical for NF-e and NFS-e, which is why
 * a single mapping serves both. `denegado` is NF-e-only: the SEFAZ refuses the
 * document over the taxpayer's own standing, and it can never be authorized.
 */
export type FocusStatus =
  | "processando_autorizacao"
  | "autorizado"
  | "cancelado"
  | "erro_autorizacao"
  | "denegado";

/** Raw NF-e consultation/webhook body. Optional throughout — most fields only exist once authorized. */
export interface FocusNfeResponse {
  status?: string;
  status_sefaz?: string;
  mensagem_sefaz?: string;
  chave_nfe?: string;
  numero?: string;
  serie?: string;
  protocolo?: string;
  ref?: string;
  cnpj_emitente?: string;
  caminho_xml_nota_fiscal?: string;
  caminho_danfe?: string;
  /**
   * Documentos da CARTA DE CORRECAO — evento proprio, com protocolo proprio.
   *
   * Nao substituem os da nota: a NF-e nao muda com a CC-e, e o DANFE impresso
   * nao carrega a correcao. Quem recebeu a mercadoria precisa do documento do
   * evento a parte, e a guarda legal de 5 anos vale para ele tambem.
   */
  caminho_xml_carta_correcao?: string;
  caminho_pdf_carta_correcao?: string;
  numero_carta_correcao?: string | number;
  erros?: Array<{ campo?: string; mensagem?: string; codigo?: string }>;
}

/** Raw NFS-e consultation/webhook body. */
export interface FocusNfseResponse {
  status?: string;
  numero?: string;
  numero_rps?: string;
  serie_rps?: string;
  codigo_verificacao?: string;
  url?: string;
  /**
   * DANFSe em PDF — **outro nome que o da NF-e**, e já absoluto (S3).
   *
   * A NF-e devolve `caminho_danfe` relativo à base; a NFS-e, nos dois padrões
   * (municipal e nacional), devolve `url_danfse` completo. Como só o campo da
   * NF-e era lido, toda NFS-e autorizada nascia sem `pdfUrl`: o botão de baixar
   * não aparecia na lista e o arquivamento legal guardava só o XML.
   */
  url_danfse?: string;
  caminho_xml_nota_fiscal?: string;
  ref?: string;
  cnpj_prestador?: string;
  mensagem?: string;
  erros?: Array<{ campo?: string; mensagem?: string; codigo?: string }>;
}

export type FocusInvoiceResponse = FocusNfeResponse & FocusNfseResponse;

/**
 * Translates a Focus status into our lifecycle.
 *
 * `denegado` maps to `rejected` rather than a state of its own: both are
 * permanent refusals that must not be retried, and the distinction is carried
 * by `rejectionCode` for the error dictionary.
 *
 * An unknown status maps to `error` — retryable — rather than throwing, so a
 * new provider status never strands an invoice.
 */
export function mapFocusStatus(status: string | undefined): FiscalInvoiceStatus {
  switch (String(status || "").trim()) {
    case "autorizado":
      return "authorized";
    case "processando_autorizacao":
      return "processing";
    case "cancelado":
      return "cancelled";
    case "erro_autorizacao":
    case "denegado":
      return "rejected";
    // Recusa do CANCELAMENTO, não da nota: ela continua autorizada. Mapear para
    // `rejected` diria que a emissão falhou, que é o oposto do que aconteceu.
    // Quem trata é `cancelInvoice`, que lança com a mensagem do fisco.
    case "erro_cancelamento":
      return "error";
    default:
      return "error";
  }
}

/** Focus returns paths like `/notas_fiscais/…`; only absolute URLs are useful downstream. */
function toAbsoluteUrl(path: string | undefined, baseUrl: string): string | undefined {
  const value = String(path || "").trim();
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  return `${baseUrl.replace(/\/+$/, "")}/${value.replace(/^\/+/, "")}`;
}

/** Collapses the several shapes Focus uses to report a failure into one message. */
function extractRejection(
  raw: FocusInvoiceResponse,
): { code?: string; message?: string } {
  const firstError = Array.isArray(raw.erros) ? raw.erros[0] : undefined;

  const message =
    String(raw.mensagem_sefaz || "").trim() ||
    String(firstError?.mensagem || "").trim() ||
    String(raw.mensagem || "").trim() ||
    undefined;

  const code =
    String(raw.status_sefaz || "").trim() ||
    String(firstError?.codigo || "").trim() ||
    undefined;

  return { code, message };
}

/**
 * Normalizes a Focus response into the provider-agnostic result.
 *
 * `baseUrl` resolves the relative document paths; `ref` is supplied by the
 * caller because Focus omits it on some synchronous responses (it is already
 * in the request URL).
 */
export function mapFocusResponse(
  raw: FocusInvoiceResponse,
  type: FiscalDocumentType,
  ref: string,
  baseUrl: string,
): FiscalInvoiceResult {
  const status = mapFocusStatus(raw.status);
  const rejection = status === "rejected" || status === "error" ? extractRejection(raw) : {};

  const result: FiscalInvoiceResult = {
    ref: String(raw.ref || ref),
    status,
    type,
  };

  const numero = String(raw.numero || "").trim();
  if (numero) result.numero = numero;

  // NF-e carries `serie`; NFS-e reports the RPS series instead.
  const serie = String(raw.serie || raw.serie_rps || "").trim();
  if (serie) result.serie = serie;

  const chave = String(raw.chave_nfe || "").trim();
  if (chave) result.chaveAcesso = chave;

  const protocolo = String(raw.protocolo || "").trim();
  if (protocolo) result.protocolo = protocolo;

  const codigoVerificacao = String(raw.codigo_verificacao || "").trim();
  if (codigoVerificacao) result.codigoVerificacao = codigoVerificacao;

  // Um campo por tipo de documento: `caminho_danfe` na NF-e, `url_danfse` na
  // NFS-e. Nunca vêm juntos, então a ordem só resolve o caso de um provedor
  // mandar os dois — e aí o da NF-e é o mais específico.
  const pdfUrl = toAbsoluteUrl(raw.caminho_danfe ?? raw.url_danfse, baseUrl);
  if (pdfUrl) result.pdfUrl = pdfUrl;

  const xmlUrl = toAbsoluteUrl(raw.caminho_xml_nota_fiscal, baseUrl);
  if (xmlUrl) result.xmlUrl = xmlUrl;

  const correcaoXmlUrl = toAbsoluteUrl(raw.caminho_xml_carta_correcao, baseUrl);
  if (correcaoXmlUrl) result.correcaoXmlUrl = correcaoXmlUrl;

  const correcaoPdfUrl = toAbsoluteUrl(raw.caminho_pdf_carta_correcao, baseUrl);
  if (correcaoPdfUrl) result.correcaoPdfUrl = correcaoPdfUrl;

  const correcaoNumero = String(raw.numero_carta_correcao ?? "").trim();
  if (correcaoNumero) result.correcaoNumero = correcaoNumero;

  const publicUrl = String(raw.url || "").trim();
  if (publicUrl) result.publicUrl = publicUrl;

  if (rejection.code) result.rejectionCode = rejection.code;
  if (rejection.message) result.rejectionMessage = rejection.message;

  return result;
}
