export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  current: number;
  retryAfterSeconds: number;
  windowMs: number;
}

export interface RateLimitStore {
  kind: "memory" | "redis";
  consume(key: string, limit: number, windowMs: number): Promise<RateLimitDecision>;
}
