/**
 * Vida do cookie `__session`, em segundos.
 *
 * `AUTH_SESSION_MAX_AGE_SECONDS` é opcional. A versão anterior fazia
 * `Number(env || "")`, e `Number("")` é `0`, que é finito: com a variável
 * ausente o padrão nunca era usado e o clamp mínimo entregava 10 minutos. Em
 * produção (onde a variável não existe) o cookie morria 10 min depois de cada
 * re-emissão, que só acontece quando o token do Firebase troca (~1h), e toda
 * navegação nessa janela caía no interstitial `/auth/refresh`.
 */
export const DEFAULT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5; // 5 dias
export const MIN_SESSION_MAX_AGE_SECONDS = 60 * 10;
export const MAX_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // teto do Firebase

export function resolveSessionMaxAgeSeconds(raw: string | undefined): number {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return DEFAULT_SESSION_MAX_AGE_SECONDS;
  const configured = Number(trimmed);
  if (!Number.isFinite(configured)) return DEFAULT_SESSION_MAX_AGE_SECONDS;
  return Math.min(
    Math.max(Math.floor(configured), MIN_SESSION_MAX_AGE_SECONDS),
    MAX_SESSION_MAX_AGE_SECONDS,
  );
}
