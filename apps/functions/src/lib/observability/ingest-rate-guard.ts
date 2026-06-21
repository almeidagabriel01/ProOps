// apps/functions/src/lib/observability/ingest-rate-guard.ts

type GuardEntry = { count: number; windowStart: number };

const MAX_KEYS = 10_000;

/**
 * Per-instance, in-memory coalescing guard. Bounds how many Firestore upserts a
 * single fingerprint can trigger per window, protecting cost under error storms.
 * Dropped writes are intentionally lost at the instance level (best-effort
 * observability, not billing) — `count` on surviving writes still climbs.
 */
export class IngestRateGuard {
  private readonly state = new Map<string, GuardEntry>();
  private readonly maxPerWindow: number;
  private readonly windowMs: number;

  constructor(maxPerWindow: number, windowMs: number) {
    this.maxPerWindow = Math.max(1, Math.floor(maxPerWindow));
    this.windowMs = Math.max(1_000, Math.floor(windowMs));
  }

  allow(fingerprint: string, now: number = Date.now()): boolean {
    if (this.state.size > MAX_KEYS) this.prune(now);
    const entry = this.state.get(fingerprint);
    if (!entry || now - entry.windowStart >= this.windowMs) {
      this.state.set(fingerprint, { count: 1, windowStart: now });
      return true;
    }
    if (entry.count >= this.maxPerWindow) return false;
    entry.count += 1;
    return true;
  }

  private prune(now: number): void {
    this.state.forEach((entry, key) => {
      if (now - entry.windowStart > this.windowMs * 2) this.state.delete(key);
    });
  }
}
