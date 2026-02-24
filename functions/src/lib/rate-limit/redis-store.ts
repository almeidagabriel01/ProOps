import { RateLimitDecision, RateLimitStore } from "./types";

type RedisRestResponse = {
  result?: unknown;
  error?: string;
};

export class RedisRestRateLimitStore implements RateLimitStore {
  public readonly kind = "redis" as const;

  private readonly restUrl: string;
  private readonly restToken: string;

  constructor(restUrl: string, restToken: string) {
    this.restUrl = String(restUrl || "").trim().replace(/\/+$/, "");
    this.restToken = String(restToken || "").trim();

    if (!this.restUrl || !this.restToken) {
      throw new Error("REDIS_REST_CONFIG_INVALID");
    }
  }

  public async consume(
    key: string,
    limit: number,
    windowMs: number,
  ): Promise<RateLimitDecision> {
    const normalizedLimit = Math.max(1, Math.floor(limit));
    const normalizedWindowMs = Math.max(1_000, Math.floor(windowMs));

    const current = Number(await this.exec(["INCR", key]));
    if (!Number.isFinite(current) || current <= 0) {
      throw new Error("REDIS_RATE_LIMIT_INVALID_INCR");
    }

    if (current === 1) {
      await this.exec(["PEXPIRE", key, String(normalizedWindowMs)]);
    }

    let ttlMs = Number(await this.exec(["PTTL", key]));
    if (!Number.isFinite(ttlMs) || ttlMs < 0) {
      ttlMs = normalizedWindowMs;
    }

    return {
      allowed: current <= normalizedLimit,
      limit: normalizedLimit,
      remaining: Math.max(0, normalizedLimit - current),
      current,
      retryAfterSeconds: Math.max(1, Math.ceil(ttlMs / 1000)),
      windowMs: normalizedWindowMs,
    };
  }

  private async exec(command: string[]): Promise<unknown> {
    const path = command.map((chunk) => encodeURIComponent(chunk)).join("/");
    const response = await fetch(`${this.restUrl}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.restToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`REDIS_RATE_LIMIT_HTTP_${response.status}`);
    }

    const payload = (await response.json()) as RedisRestResponse;
    if (payload.error) {
      throw new Error(`REDIS_RATE_LIMIT_${payload.error}`);
    }
    return payload.result;
  }
}
