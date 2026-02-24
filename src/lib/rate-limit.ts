/**
 * In-memory rate limiter using sliding window per key (IP).
 *
 * NOTE: This is per-process and resets on server restart.
 * For production-scale apps behind multiple instances, consider
 * a shared store (Redis / Upstash). For a single-instance Next.js
 * deployment this is perfectly adequate.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Auto-cleanup stale entries every 10 minutes to prevent memory leaks
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup(windowMs: number) {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      // Remove entries whose newest timestamp is older than the window
      if (entry.timestamps.length === 0 || entry.timestamps[entry.timestamps.length - 1] < now - windowMs) {
        store.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  // Allow Node to exit even if timer is pending
  if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

interface RateLimitResult {
  allowed: boolean;
  /** Remaining attempts in the current window */
  remaining: number;
  /** Seconds until the oldest attempt in the window expires (only meaningful when blocked) */
  retryAfterSeconds: number;
}

/**
 * Check and optionally consume one attempt for the given key.
 *
 * @param key       - Unique identifier (e.g. client IP)
 * @param maxAttempts - Maximum attempts allowed within the window
 * @param windowMs  - Sliding window duration in milliseconds
 * @param dryRun    - If true, only check the limit without consuming an attempt
 */
export function rateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
  dryRun: boolean = false,
): RateLimitResult {
  ensureCleanup(windowMs);

  const now = Date.now();
  const entry = store.get(key) || { timestamps: [] };

  // Prune timestamps outside the current window
  entry.timestamps = entry.timestamps.filter((ts) => ts > now - windowMs);

  if (entry.timestamps.length >= maxAttempts) {
    // Rate limited — calculate retry-after from oldest timestamp in window
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = oldestInWindow + windowMs - now;
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  // In dryRun mode, only check — don't record
  if (dryRun) {
    return {
      allowed: true,
      remaining: maxAttempts - entry.timestamps.length,
      retryAfterSeconds: 0,
    };
  }

  // Allow and record this attempt
  entry.timestamps.push(now);
  store.set(key, entry);

  return {
    allowed: true,
    remaining: maxAttempts - entry.timestamps.length,
    retryAfterSeconds: 0,
  };
}
