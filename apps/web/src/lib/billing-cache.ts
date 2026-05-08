interface CachedBillingState {
  subscriptionStatus: string;
  pastDueSince: string | null;
  cachedAt: number;
}

// Module-level singleton: same Map instance reused across requests in the same
// warm Node.js process. Both billing-status and its invalidation route import
// from here so cache.delete() in one is visible to the other.
export const billingCache = new Map<string, CachedBillingState>();

export type { CachedBillingState };
