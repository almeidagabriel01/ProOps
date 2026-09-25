import type { DecodedIdToken } from "firebase-admin/auth";

/**
 * Revogação do session cookie conferida com cache curto por usuário.
 *
 * `verifySessionCookie(cookie, true)` busca o usuário no Firebase Auth a cada
 * chamada, e a rota de billing roda em toda navegação do ERP. Aqui a
 * assinatura continua verificada sempre (`checkRevoked=false` só pula a busca);
 * o estado do usuário (desativado / tokensValidAfterTime) fica em memória por
 * até 60s por instância. Mesma política do backend
 * (`apps/functions/src/lib/token-revocation.ts`).
 */

export const SESSION_REVOCATION_TTL_MS = 60_000;
const MAX_ENTRIES = 5_000;

export type RevocationState = { disabled: boolean; validSinceMs: number | null };

type Entry = RevocationState & { expiresAt: number };
const cache = new Map<string, Entry>();

export function evaluateSessionRevocation(
  decoded: Pick<DecodedIdToken, "auth_time">,
  state: RevocationState,
): "ok" | "disabled" | "revoked" {
  if (state.disabled) return "disabled";
  if (state.validSinceMs !== null && decoded.auth_time * 1000 < state.validSinceMs) {
    return "revoked";
  }
  return "ok";
}

function withCode(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}

/**
 * Lança com os códigos do Admin SDK (`auth/user-disabled`,
 * `auth/session-cookie-revoked`), que a rota já sabe traduzir.
 */
export async function assertSessionNotRevoked(
  decoded: DecodedIdToken,
  loadUser: (uid: string) => Promise<{ disabled?: boolean; tokensValidAfterTime?: string }>,
  nowMs: number = Date.now(),
): Promise<void> {
  let entry = cache.get(decoded.uid);
  if (!entry || entry.expiresAt <= nowMs) {
    const user = await loadUser(decoded.uid);
    const validSince = user.tokensValidAfterTime ? Date.parse(user.tokensValidAfterTime) : NaN;
    entry = {
      disabled: Boolean(user.disabled),
      validSinceMs: Number.isFinite(validSince) ? validSince : null,
      expiresAt: nowMs + SESSION_REVOCATION_TTL_MS,
    };
    if (cache.size >= MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(decoded.uid, entry);
  }

  const verdict = evaluateSessionRevocation(decoded, entry);
  if (verdict === "disabled") throw withCode("auth/user-disabled", "The user record is disabled.");
  if (verdict === "revoked") {
    throw withCode("auth/session-cookie-revoked", "The Firebase session cookie has been revoked.");
  }
}

export function clearSessionRevocationCacheForTest(): void {
  cache.clear();
}
