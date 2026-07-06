import { LRUCache } from "lru-cache";
import { db } from "../init";

/**
 * Cache único (por instância) do documento tenants/{tenantId}.
 *
 * Fonte compartilhada de leitura para require-active-subscription e
 * tenant-plan-policy — antes cada um mantinha um LRU próprio lendo o mesmo
 * doc. TTL curto (5s) para que revogação de acesso por billing (webhook
 * Stripe → invalidateTenantDoc) reflita rápido; entre instâncias a janela de
 * inconsistência máxima é o próprio TTL.
 */

export type TenantDocState = {
  exists: boolean;
  data: Record<string, unknown> | undefined;
};

const MAX_TENANTS = 500;
const TTL_MS = 5_000;

const cache = new LRUCache<string, TenantDocState>({ max: MAX_TENANTS, ttl: TTL_MS });

export async function getTenantDocCached(tenantId: string): Promise<TenantDocState> {
  const hit = cache.get(tenantId);
  if (hit) return hit;

  const snap = await db.collection("tenants").doc(tenantId).get();
  const state: TenantDocState = {
    exists: snap.exists,
    data: snap.data() as Record<string, unknown> | undefined,
  };
  cache.set(tenantId, state);
  return state;
}

export function invalidateTenantDoc(tenantId: string): void {
  cache.delete(tenantId);
}

export function clearTenantDocCache(): void {
  cache.clear();
}
