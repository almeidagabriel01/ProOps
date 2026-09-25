import { LRUCache } from "lru-cache";
import type { DecodedIdToken, UserRecord } from "firebase-admin/auth";
import { auth } from "../init";

/**
 * Checagem de revogação de sessão com cache curto por usuário.
 *
 * `verifyIdToken(token, true)` busca o usuário no Firebase Auth a CADA
 * request só para comparar `auth_time` com `tokensValidAfterTime` — uma ida e
 * volta de rede fixa em todo clique. Aqui a assinatura do token continua
 * verificada em toda request (`checkRevoked=false` só pula a busca); o que
 * fica em cache, por até 60s e por instância, é o estado do usuário.
 *
 * Consequência aceita: um logout forçado, troca de senha ou desativação leva
 * até o TTL para derrubar a sessão na API. `AUTH_REVOCATION_CACHE_TTL_MS=0`
 * volta a conferir em toda request.
 */

type RevocationState = {
  disabled: boolean;
  validSinceMs: number | null;
};

type TokenSource = "bearer" | "session_cookie" | "legacy_cookie";

const DEFAULT_TTL_MS = 60_000;
const MAX_USERS = 5_000;

function resolveTtlMs(): number {
  const raw = Number(process.env.AUTH_REVOCATION_CACHE_TTL_MS);
  if (!Number.isFinite(raw) || raw < 0) return DEFAULT_TTL_MS;
  return Math.min(raw, 5 * 60_000);
}

let cache: LRUCache<string, RevocationState> | null = null;
let cacheTtl = -1;

function getCache(): LRUCache<string, RevocationState> | null {
  const ttl = resolveTtlMs();
  if (ttl === 0) return null;
  if (!cache || cacheTtl !== ttl) {
    cache = new LRUCache<string, RevocationState>({ max: MAX_USERS, ttl });
    cacheTtl = ttl;
  }
  return cache;
}

function stateFromUserRecord(record: UserRecord): RevocationState {
  const validSince = record.tokensValidAfterTime
    ? Date.parse(record.tokensValidAfterTime)
    : NaN;
  return {
    disabled: Boolean(record.disabled),
    validSinceMs: Number.isFinite(validSince) ? validSince : null,
  };
}

/** Pura: mesma regra do Admin SDK (`auth_time` em segundos contra `validSince`). */
export function evaluateRevocation(
  decoded: Pick<DecodedIdToken, "auth_time">,
  state: RevocationState,
): "ok" | "disabled" | "revoked" {
  if (state.disabled) return "disabled";
  if (state.validSinceMs !== null && decoded.auth_time * 1000 < state.validSinceMs) {
    return "revoked";
  }
  return "ok";
}

/** Guarda o estado de um UserRecord que o chamador já buscou (evita nova ida à rede). */
export function rememberUserRecord(record: UserRecord): void {
  getCache()?.set(record.uid, stateFromUserRecord(record));
}

async function getRevocationState(uid: string): Promise<RevocationState> {
  const c = getCache();
  const hit = c?.get(uid);
  if (hit) return hit;
  const record = await auth.getUser(uid);
  const state = stateFromUserRecord(record);
  c?.set(uid, state);
  return state;
}

function buildAuthError(code: string, message: string): Error {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  return err;
}

/**
 * Lança com os mesmos códigos do Admin SDK quando o usuário está desativado
 * ou a sessão foi revogada. `freshRecord`, quando o chamador já buscou o
 * usuário na mesma request, é usado direto e atualiza o cache.
 */
export async function assertTokenNotRevoked(
  decoded: DecodedIdToken,
  tokenSource: TokenSource,
  freshRecord?: UserRecord,
): Promise<void> {
  let state: RevocationState;
  if (freshRecord) {
    state = stateFromUserRecord(freshRecord);
    getCache()?.set(decoded.uid, state);
  } else {
    state = await getRevocationState(decoded.uid);
  }

  const verdict = evaluateRevocation(decoded, state);
  if (verdict === "disabled") {
    throw buildAuthError(
      "auth/user-disabled",
      "The user record is disabled.",
    );
  }
  if (verdict === "revoked") {
    throw tokenSource === "session_cookie"
      ? buildAuthError(
          "auth/session-cookie-revoked",
          "The Firebase session cookie has been revoked.",
        )
      : buildAuthError(
          "auth/id-token-revoked",
          "The Firebase ID token has been revoked.",
        );
  }
}

export function invalidateRevocationState(uid: string): void {
  getCache()?.delete(uid);
}

export function clearRevocationCacheForTest(): void {
  cache = null;
  cacheTtl = -1;
}
