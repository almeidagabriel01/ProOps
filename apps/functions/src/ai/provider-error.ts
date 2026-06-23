/**
 * Structured classification of AI provider (Gemini / Groq) errors.
 *
 * Both live providers use the `@google/genai` SDK (Groq via `groq-sdk`). When a
 * request fails, the SDK throws an error whose `.message` typically carries the
 * provider's structured JSON payload, e.g.:
 *
 *   { "error": { "code": 400, "message": "API key not valid...",
 *       "status": "INVALID_ARGUMENT", "details": [{ "reason": "API_KEY_INVALID" }] } }
 *
 * This module turns that opaque error into a typed category so the routes can
 * (a) return a precise, user-safe message and (b) decide whether the failure is
 * operator-actionable (a dead key / exhausted quota) and must raise an alert.
 *
 * Pure — no I/O, never throws. Trivially unit-testable.
 */

export type ProviderErrorCategory =
  | "config_invalid_key"
  | "quota_exhausted"
  | "rate_limited"
  | "transient"
  | "unknown";

export interface ProviderErrorClassification {
  category: ProviderErrorCategory;
  httpCode?: number;
  /** Provider status string, e.g. "INVALID_ARGUMENT" | "RESOURCE_EXHAUSTED". */
  providerStatus?: string;
  /** Provider reason code, e.g. "API_KEY_INVALID". */
  providerReason?: string;
  /** pt-BR, browser-safe message shown to the end user. */
  clientMessage: string;
  /** True for config_invalid_key & quota_exhausted — needs operator attention. */
  operatorActionable: boolean;
}

const CLIENT_MESSAGES: Record<ProviderErrorCategory, string> = {
  config_invalid_key:
    "O assistente está temporariamente indisponível. Nossa equipe já foi notificada. Tente novamente em alguns minutos.",
  quota_exhausted:
    "O assistente está temporariamente indisponível. Nossa equipe já foi notificada. Tente novamente em alguns minutos.",
  rate_limited:
    "Serviço de IA temporariamente sobrecarregado. Tente novamente em alguns instantes.",
  transient: "Tive um problema momentâneo ao processar sua resposta. Tente novamente.",
  unknown: "Erro ao processar resposta da IA.",
};

interface ExtractedFields {
  message: string;
  lowerMessage: string;
  httpCode?: number;
  providerStatus?: string;
  providerReason?: string;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

/** Reads the human-readable message off an unknown thrown value. */
function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message ?? "";
  if (typeof err === "string") return err;
  const rec = asRecord(err);
  if (rec && typeof rec.message === "string") return rec.message;
  if (err === null || err === undefined) return "";
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/** Parses a `{ "error": { code, status, details:[{reason}] } }` JSON embedded anywhere in `message`. */
function parseEmbeddedJsonError(message: string): {
  code?: number;
  status?: string;
  reason?: string;
} {
  const start = message.indexOf("{");
  const end = message.lastIndexOf("}");
  if (start === -1 || end <= start) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(message.slice(start, end + 1));
  } catch {
    return {};
  }
  const root = asRecord(parsed);
  const errorObj = asRecord(root?.error) ?? root;
  if (!errorObj) return {};

  const code = typeof errorObj.code === "number" ? errorObj.code : undefined;
  const status = typeof errorObj.status === "string" ? errorObj.status : undefined;

  let reason: string | undefined;
  const details = errorObj.details;
  if (Array.isArray(details)) {
    for (const detail of details) {
      const detailRec = asRecord(detail);
      if (detailRec && typeof detailRec.reason === "string") {
        reason = detailRec.reason;
        break;
      }
    }
  }
  return { code, status, reason };
}

/** Reads a numeric HTTP status off common SDK error shapes (`.status`, `.statusCode`, `.code`). */
function extractNumericHttpCode(err: unknown): number | undefined {
  const rec = asRecord(err);
  if (!rec) return undefined;
  for (const key of ["status", "statusCode", "code"]) {
    const value = rec[key];
    if (typeof value === "number" && value >= 100 && value <= 599) return value;
  }
  return undefined;
}

function extractFields(err: unknown): ExtractedFields {
  const message = extractMessage(err);
  const json = parseEmbeddedJsonError(message);
  return {
    message,
    lowerMessage: message.toLowerCase(),
    // Prefer the structured JSON code; fall back to a numeric SDK field.
    httpCode: json.code ?? extractNumericHttpCode(err),
    providerStatus: json.status,
    providerReason: json.reason,
  };
}

function includesAny(haystack: string, needles: readonly string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

function detectCategory(f: ExtractedFields): ProviderErrorCategory {
  const { lowerMessage, httpCode, providerStatus, providerReason } = f;
  const status = (providerStatus ?? "").toUpperCase();
  const reason = (providerReason ?? "").toUpperCase();

  // 1. Invalid key / permission — operator-actionable config error.
  if (
    reason === "API_KEY_INVALID" ||
    reason === "PERMISSION_DENIED" ||
    status === "PERMISSION_DENIED" ||
    status === "UNAUTHENTICATED" ||
    includesAny(lowerMessage, [
      "api key not valid",
      "api_key_invalid",
      "permission_denied",
      "permission denied",
      "invalid api key",
      "unauthenticated",
    ]) ||
    httpCode === 401 ||
    httpCode === 403
  ) {
    return "config_invalid_key";
  }

  // 2. Quota / billing exhausted — operator-actionable. Checked before rate_limited
  //    because quota errors are also surfaced as HTTP 429.
  if (
    status === "RESOURCE_EXHAUSTED" ||
    includesAny(lowerMessage, [
      "resource_exhausted",
      "insufficient_quota",
      "exceeded your current quota",
      "quota",
      "billing",
    ])
  ) {
    return "quota_exhausted";
  }

  // 3. Rate limited — transient, retryable.
  if (
    httpCode === 429 ||
    includesAny(lowerMessage, ["too many requests", "rate limit", "rate_limit_exceeded"]) ||
    lowerMessage.includes("429")
  ) {
    return "rate_limited";
  }

  // 4. Transient infrastructure / network errors.
  if (
    (typeof httpCode === "number" && httpCode >= 500 && httpCode <= 599) ||
    includesAny(lowerMessage, [
      "unavailable",
      "deadline_exceeded",
      "econnreset",
      "etimedout",
      "socket hang up",
      "fetch failed",
      "network",
      "internal error",
    ])
  ) {
    return "transient";
  }

  return "unknown";
}

/**
 * Classify an unknown error thrown by a Gemini or Groq call. Never throws.
 */
export function classifyProviderError(err: unknown): ProviderErrorClassification {
  const fields = extractFields(err);
  const category = detectCategory(fields);
  return {
    category,
    httpCode: fields.httpCode,
    providerStatus: fields.providerStatus,
    providerReason: fields.providerReason,
    clientMessage: CLIENT_MESSAGES[category],
    operatorActionable:
      category === "config_invalid_key" || category === "quota_exhausted",
  };
}
