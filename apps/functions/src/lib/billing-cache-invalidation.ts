import { logger } from "./logger";

/**
 * Best-effort invalidation of the Next.js billing-status in-process cache.
 * Called after billing status changes in Firestore to avoid the 5s TTL window.
 * Never throws — failure is acceptable since the TTL is already short (5s).
 */
export async function invalidateNextjsBillingCache(
  tenantId: string,
): Promise<void> {
  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    ""
  ).replace(/\/$/, "");
  const secret = process.env.BILLING_CACHE_INVALIDATION_SECRET;

  if (!appUrl || !secret) {
    return;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    try {
      const res = await fetch(
        `${appUrl}/api/auth/billing-status/invalidate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-invalidation-secret": secret,
          },
          body: JSON.stringify({ tenantId }),
          signal: controller.signal,
        },
      );
      if (!res.ok) {
        logger.warn("billing_cache_invalidation: non_ok", {
          tenantId,
          status: res.status,
        });
      }
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    logger.warn("billing_cache_invalidation: request_failed", {
      tenantId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
