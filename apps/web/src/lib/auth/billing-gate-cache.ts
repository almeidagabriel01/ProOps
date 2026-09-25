import { resolveBillingAccess } from "@/lib/auth/billing-access";

/**
 * Cache, no proxy, das respostas PERMITIDAS do gate de billing.
 *
 * Toda navegação do ERP chamava `/api/auth/billing-status`, uma segunda
 * função, antes de renderizar. Aqui o proxy guarda por 30s o estado que a rota
 * devolveu (papel e status da assinatura) e decide o próximo caminho sozinho,
 * com a MESMA função pura da rota.
 *
 * Só se guarda estado que deu acesso, e só se usa o cache quando ele volta a
 * dar acesso para o caminho pedido. Qualquer negação (assinatura bloqueada,
 * conta free fora da allowlist, sessão revogada) é sempre confirmada pela rota.
 * Com isso quem acabou de pagar nunca fica preso num "bloqueado" em cache, e o
 * pior caso é um acesso que acabou de ser cortado durar até 30s, dentro dos
 * 60s de cache que a própria rota já aplica ao status do tenant.
 */

export const BILLING_GATE_CACHE_TTL_MS = 30_000;
const MAX_ENTRIES = 2_000;

export type BillingSnapshot =
  | { bypass: true }
  | {
      bypass?: false;
      role: string | null;
      subscriptionStatus: string;
      pastDueSince: string | null;
    };

type Entry = { snapshot: BillingSnapshot; expiresAt: number };
const cache = new Map<string, Entry>();

export async function hashSessionCookie(cookie: string): Promise<string> {
  const bytes = new TextEncoder().encode(cookie);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** true = pode seguir sem chamar a rota; false = consultar a rota. */
export function isAllowedFromCache(
  key: string,
  requestedPath: string,
  nowMs: number = Date.now(),
): boolean {
  const entry = cache.get(key);
  if (!entry) return false;
  if (entry.expiresAt <= nowMs) {
    cache.delete(key);
    return false;
  }
  const snap = entry.snapshot;
  if (snap.bypass) return true;
  return resolveBillingAccess({
    role: snap.role,
    subscriptionStatus: snap.subscriptionStatus,
    pastDueSince: snap.pastDueSince,
    requestedPath,
    nowMs,
  }).allowed;
}

export function rememberAllowedSnapshot(
  key: string,
  snapshot: BillingSnapshot | undefined,
  nowMs: number = Date.now(),
): void {
  if (!snapshot) return;
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { snapshot, expiresAt: nowMs + BILLING_GATE_CACHE_TTL_MS });
}

export function clearBillingGateCacheForTest(): void {
  cache.clear();
}
