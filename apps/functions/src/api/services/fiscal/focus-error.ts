/**
 * Normalizes anything thrown while talking to Focus NFe.
 *
 * Mirrors `describeAsaasError`, with one addition that matters for fiscal
 * documents: the distinction between a *retryable* failure (network, provider
 * outage, still queued) and a *permanent* one (schema rejected, SEFAZ refused).
 * Retrying a permanent failure burns numbers from the series and never
 * succeeds; giving up on a transient one strands a document the client needs.
 *
 * Never leaks secrets — the certificate and its password travel in request
 * bodies, which are deliberately not read here.
 */

import axios from "axios";

export interface FocusErrorDetail {
  httpStatus?: number;
  /** Provider error code, e.g. `erro_validacao_schema`, `requisicao_invalida`. */
  codigo?: string;
  message: string;
  /** Per-field validation failures, when the provider itemizes them. */
  fieldErrors?: Array<{ campo?: string; mensagem?: string }>;
  retryable: boolean;
}

interface FocusErrorBody {
  codigo?: string;
  mensagem?: string;
  erros?: Array<{ campo?: string; mensagem?: string; codigo?: string }>;
}

/**
 * Provider codes that describe the request itself, not a passing condition.
 * Retrying any of these produces the same answer.
 */
const PERMANENT_CODES = new Set([
  "erro_validacao_schema",
  "requisicao_invalida",
  "formato_invalido",
  "erro_validacao",
  "nao_autorizado",
  "already_processed",
  "permissao_negada",
]);

/**
 * `pending_operation` reads like an error but means the document is still in
 * flight. It is the one code that should always be retried.
 */
const PENDING_CODE = "pending_operation";

function isRetryableStatus(httpStatus: number | undefined): boolean {
  if (httpStatus === undefined) {
    // No response at all — DNS, timeout, connection reset. Worth another try.
    return true;
  }
  // 429 and 5xx are transient by definition; 4xx means we sent something wrong.
  return httpStatus === 429 || httpStatus >= 500;
}

/**
 * Extracts a structured description from an unknown thrown value.
 * Handles Axios errors carrying a Focus response body, plain Errors, and
 * arbitrary unknowns.
 */
export function describeFocusError(err: unknown): FocusErrorDetail {
  if (axios.isAxiosError(err)) {
    const httpStatus = err.response?.status;
    const body = err.response?.data as FocusErrorBody | undefined;

    const fieldErrors = Array.isArray(body?.erros)
      ? body.erros.filter((e) => e && (e.campo !== undefined || e.mensagem !== undefined))
      : undefined;

    const codigo = String(body?.codigo || "").trim() || undefined;

    const message =
      String(body?.mensagem || "").trim() ||
      fieldErrors?.[0]?.mensagem ||
      err.message;

    let retryable: boolean;
    if (codigo === PENDING_CODE) {
      retryable = true;
    } else if (codigo && PERMANENT_CODES.has(codigo)) {
      retryable = false;
    } else {
      retryable = isRetryableStatus(httpStatus);
    }

    return {
      ...(httpStatus !== undefined ? { httpStatus } : {}),
      ...(codigo ? { codigo } : {}),
      message,
      ...(fieldErrors?.length ? { fieldErrors } : {}),
      retryable,
    };
  }

  if (err instanceof Error) {
    // Locally raised guards (NFE_SEM_ITENS, NFSE_SEM_SERVICO, missing token)
    // are all programming or configuration faults — never worth a retry.
    return { message: err.message, retryable: false };
  }

  return { message: String(err), retryable: false };
}
