/**
 * Whether the legacy `firebase-auth-token` cookie may be accepted as an auth
 * fallback.
 *
 * It is a DEV-ONLY compatibility shim and is HARD-disabled in production
 * regardless of AUTH_ACCEPT_LEGACY_COOKIE_HINT — the env var can never
 * re-enable it in prod (fail-closed; removes the dependency on the env being
 * set correctly). In non-prod it defaults on, and
 * AUTH_ACCEPT_LEGACY_COOKIE_HINT="false" still turns it off.
 */
export function shouldAcceptLegacyAuthCookie(env?: {
  NODE_ENV?: string;
  AUTH_ACCEPT_LEGACY_COOKIE_HINT?: string;
}): boolean {
  const source = env ?? process.env;
  const isProduction =
    String(source.NODE_ENV || "").trim().toLowerCase() === "production";

  if (isProduction) {
    return false;
  }

  return (
    String(source.AUTH_ACCEPT_LEGACY_COOKIE_HINT || "true")
      .trim()
      .toLowerCase() !== "false"
  );
}
