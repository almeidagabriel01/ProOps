import { logSecurityEvent } from "../security-observability";
import { MemoryRateLimitStore } from "./memory-store";
import { RedisRestRateLimitStore } from "./redis-store";
import { RateLimitStore } from "./types";

let singletonStore: RateLimitStore | null = null;
let fallbackWarningLogged = false;

function readRedisConfig(): { url: string; token: string } {
  const url =
    String(process.env.RATE_LIMIT_REDIS_REST_URL || "").trim() ||
    String(process.env.UPSTASH_REDIS_REST_URL || "").trim();
  const token =
    String(process.env.RATE_LIMIT_REDIS_REST_TOKEN || "").trim() ||
    String(process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
  return { url, token };
}

function shouldUseRedis(): boolean {
  return (
    String(process.env.RATE_LIMIT_STORE || "memory")
      .trim()
      .toLowerCase() === "redis"
  );
}

export function createRateLimitStore(): RateLimitStore {
  if (singletonStore) return singletonStore;

  if (!shouldUseRedis()) {
    singletonStore = new MemoryRateLimitStore();
    return singletonStore;
  }

  const redisConfig = readRedisConfig();
  if (!redisConfig.url || !redisConfig.token) {
    if (!fallbackWarningLogged) {
      fallbackWarningLogged = true;
      logSecurityEvent(
        "ratelimit_store_fallback_memory",
        {
          source: "rate_limit_factory",
          reason:
            "RATE_LIMIT_STORE=redis configured without REST URL/TOKEN. Falling back to memory.",
        },
        "WARN",
      );
    }
    singletonStore = new MemoryRateLimitStore();
    return singletonStore;
  }

  try {
    singletonStore = new RedisRestRateLimitStore(
      redisConfig.url,
      redisConfig.token,
    );
    return singletonStore;
  } catch (error) {
    if (!fallbackWarningLogged) {
      fallbackWarningLogged = true;
      logSecurityEvent(
        "ratelimit_store_fallback_memory",
        {
          source: "rate_limit_factory",
          reason:
            error instanceof Error ? error.message : "redis_init_failed",
        },
        "WARN",
      );
    }
    singletonStore = new MemoryRateLimitStore();
    return singletonStore;
  }
}
