import { syncTenantBillingFromStripe } from "./billing-sync.service";
import type { BillingSnapshot } from "./billing-types";

class Semaphore {
  private current = 0;
  private readonly queue: Array<() => void> = [];
  constructor(private readonly max: number) {}

  async acquire(): Promise<void> {
    if (this.current < this.max) {
      this.current++;
      return;
    }
    return new Promise<void>((resolve) => this.queue.push(resolve));
  }

  release(): void {
    this.current--;
    const next = this.queue.shift();
    if (next) {
      this.current++;
      next();
    }
  }
}

const concurrencySemaphore = new Semaphore(5);

let tokens = 10;
let lastRefillMs = Date.now();

function consumeRateToken(): Promise<void> {
  const now = Date.now();
  const elapsed = (now - lastRefillMs) / 1000;
  tokens = Math.min(10, tokens + elapsed * 10);
  lastRefillMs = now;
  if (tokens >= 1) {
    tokens--;
    return Promise.resolve();
  }
  const waitMs = Math.ceil(((1 - tokens) / 10) * 1000);
  tokens = 0;
  return new Promise<void>((resolve) => setTimeout(resolve, waitMs));
}

const inFlight = new Map<string, Promise<BillingSnapshot>>();

export function enqueueTenantSync(
  tenantId: string,
  source: BillingSnapshot["source"],
): Promise<BillingSnapshot> {
  const existing = inFlight.get(tenantId);
  if (existing) return existing;

  const p = (async () => {
    await consumeRateToken();
    await concurrencySemaphore.acquire();
    try {
      return await syncTenantBillingFromStripe(tenantId, { source });
    } finally {
      concurrencySemaphore.release();
      inFlight.delete(tenantId);
    }
  })();

  inFlight.set(tenantId, p);
  return p;
}

export function isSyncInFlight(tenantId: string): boolean {
  return inFlight.has(tenantId);
}

export function isStale(
  snap: { billingSyncedAt?: unknown; subscriptionStatus?: string },
  maxAgeMs = 5 * 60 * 1000,
): boolean {
  const status = String(snap.subscriptionStatus || "").toLowerCase();
  if (status === "free" || status === "") return false;
  const synced = snap.billingSyncedAt;
  if (!synced || typeof synced !== "string") return true;
  return Date.now() - new Date(synced).getTime() > maxAgeMs;
}
