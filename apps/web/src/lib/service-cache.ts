const FIVE_MIN = 5 * 60 * 1000;
const ONE_MIN = 60 * 1000;

/**
 * Single-value TTL cache with in-flight deduplication.
 * Use for global/static data that does not vary by key (e.g. public price lists).
 */
export function createTTLCache<T>(ttlMs: number = FIVE_MIN) {
  let cache: { data: T; expiresAt: number } | null = null;
  let inFlight: Promise<T> | null = null;

  return {
    async get(fetcher: () => Promise<T>): Promise<T> {
      if (cache && Date.now() < cache.expiresAt) return cache.data;
      if (inFlight) return inFlight;
      inFlight = (async () => {
        try {
          const data = await fetcher();
          cache = { data, expiresAt: Date.now() + ttlMs };
          return data;
        } finally {
          inFlight = null;
        }
      })();
      return inFlight;
    },
    invalidate() {
      cache = null;
    },
  };
}

/**
 * Keyed TTL cache with per-key in-flight deduplication.
 * Use for tenant-scoped data where the key is typically the tenantId.
 */
export function createKeyedTTLCache<T>(ttlMs: number = ONE_MIN) {
  const store = new Map<string, { data: T; expiresAt: number }>();
  const inFlight = new Map<string, Promise<T>>();

  return {
    async get(key: string, fetcher: () => Promise<T>): Promise<T> {
      const cached = store.get(key);
      if (cached && Date.now() < cached.expiresAt) return cached.data;
      const existing = inFlight.get(key);
      if (existing) return existing;
      const promise = (async () => {
        try {
          const data = await fetcher();
          store.set(key, { data, expiresAt: Date.now() + ttlMs });
          return data;
        } finally {
          inFlight.delete(key);
        }
      })();
      inFlight.set(key, promise);
      return promise;
    },
    invalidate(key?: string) {
      if (key) store.delete(key);
      else store.clear();
    },
  };
}
