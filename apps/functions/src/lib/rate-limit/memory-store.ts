import { RateLimitDecision, RateLimitStore } from "./types";

type MemoryRateLimitEntry = {
  count: number;
  windowStart: number;
};

const DEFAULT_MAX_KEYS = 25_000;

export class MemoryRateLimitStore implements RateLimitStore {
  public readonly kind = "memory" as const;

  private readonly state = new Map<string, MemoryRateLimitEntry>();
  private readonly maxKeys: number;

  constructor(maxKeys: number = DEFAULT_MAX_KEYS) {
    this.maxKeys = Math.max(1_000, Math.floor(maxKeys));
  }

  public async consume(
    key: string,
    limit: number,
    windowMs: number,
  ): Promise<RateLimitDecision> {
    const normalizedLimit = Math.max(1, Math.floor(limit));
    const normalizedWindowMs = Math.max(1_000, Math.floor(windowMs));
    const now = Date.now();

    if (this.state.size > this.maxKeys) {
      this.prune(now, normalizedWindowMs);
    }

    const current = this.state.get(key);
    if (!current || now - current.windowStart >= normalizedWindowMs) {
      this.state.set(key, { count: 1, windowStart: now });
      return {
        allowed: true,
        limit: normalizedLimit,
        remaining: normalizedLimit - 1,
        current: 1,
        retryAfterSeconds: Math.ceil(normalizedWindowMs / 1000),
        windowMs: normalizedWindowMs,
      };
    }

    current.count += 1;
    this.state.set(key, current);

    const remaining = Math.max(0, normalizedLimit - current.count);
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((normalizedWindowMs - (now - current.windowStart)) / 1000),
    );

    return {
      allowed: current.count <= normalizedLimit,
      limit: normalizedLimit,
      remaining,
      current: current.count,
      retryAfterSeconds,
      windowMs: normalizedWindowMs,
    };
  }

  private prune(now: number, windowMs: number): void {
    this.state.forEach((entry, key) => {
      if (now - entry.windowStart > windowMs * 2) {
        this.state.delete(key);
      }
    });
  }
}
