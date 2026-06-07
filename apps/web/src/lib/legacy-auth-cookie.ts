/**
 * Whether the legacy `firebase-auth-token` cookie may be accepted as an auth
 * fallback.
 *
 * Fail-CLOSED por default. O shim só é aceito quando TODAS as condições valem:
 *   1. NODE_ENV === "development" EXPLÍCITO (env do servidor, não controlável
 *      pelo cliente). Ausente / "production" / "test" / qualquer outro → recusa.
 *   2. opt-out não acionado (AUTH_ACCEPT_LEGACY_COOKIE_HINT !== "false").
 *   3. host da requisição PRESENTE e loopback. O host é avaliado só DEPOIS do
 *      gate de NODE_ENV — nunca autoriza sozinho, só pode restringir.
 *
 * Invariante: nenhum input controlável pelo cliente (incluindo o header Host)
 * pode, sozinho, fazer o cookie legado ser aceito.
 */
export function shouldAcceptLegacyAuthCookie(input?: {
  host?: string | null;
  env?: { NODE_ENV?: string; AUTH_ACCEPT_LEGACY_COOKIE_HINT?: string };
}): boolean {
  const env = input?.env ?? process.env;

  const isDevelopment =
    String(env.NODE_ENV || "").trim().toLowerCase() === "development";
  if (!isDevelopment) {
    return false;
  }

  const optedOut =
    String(env.AUTH_ACCEPT_LEGACY_COOKIE_HINT || "true").trim().toLowerCase() ===
    "false";
  if (optedOut) {
    return false;
  }

  // Estrito: host deve estar presente E ser loopback. Ausente ou não-loopback
  // → recusa (fail-closed). Um caller que esqueça de passar o host falha de
  // forma visível e segura, em vez de relaxar para o NODE_ENV ser o único gate.
  if (input?.host == null || !isLoopbackHost(input.host)) {
    return false;
  }

  return true;
}

function isLoopbackHost(host: string): boolean {
  const h = String(host)
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, ""); // remove a porta (ex: localhost:3000)

  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "::1" ||
    h === "[::1]" ||
    h === "0.0.0.0" ||
    h.endsWith(".localhost") ||
    h.endsWith(".local")
  );
}
