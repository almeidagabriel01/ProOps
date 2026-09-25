/**
 * Quais falhas do `POST /api/auth/session` contam para o rate limit por IP.
 *
 * O limite (5 falhas por IP em 15 min) existe contra abuso: corpo inválido e
 * token forjado ou malformado. Antes TODA exceção contava, inclusive re-sync
 * legítimo em segundo plano com token expirado ou revogado e erro de
 * infraestrutura do Firebase. Num escritório atrás de um IP só, as tentativas
 * em cascata do interstitial `/auth/refresh` estouravam o limite e a
 * pré-checagem passava a barrar a re-emissão E o próprio login, até de quem
 * tinha token válido.
 *
 * Brute force de ID token não é uma ameaça real (é um JWT assinado pelo
 * Google), então não contar os casos abaixo não abre nada: a requisição
 * continua recusada com 401, só não bloqueia o IP.
 */
export type SessionFailureStage = "request" | "verify-token" | "after-verify";

const LEGITIMATE_TOKEN_REJECTIONS = new Set([
  "auth/id-token-expired",
  "auth/id-token-revoked",
  "auth/user-disabled",
  "auth/user-not-found",
]);

const INFRASTRUCTURE_ERRORS = new Set([
  "auth/internal-error",
  "auth/network-request-failed",
  "app/network-error",
  "app/network-timeout",
  "auth/quota-exceeded",
]);

export function shouldCountSessionFailure(
  stage: SessionFailureStage,
  error: unknown,
): boolean {
  // Corpo ilegível ou sem idToken: só abuso chega aqui.
  if (stage === "request") return true;
  // O token já foi aceito; o que falha depois é nosso ou do Firebase.
  if (stage === "after-verify") return false;
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === "string") {
    if (LEGITIMATE_TOKEN_REJECTIONS.has(code)) return false;
    if (INFRASTRUCTURE_ERRORS.has(code)) return false;
  }
  return true;
}
