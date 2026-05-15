import * as admin from "firebase-admin";
import type { Firestore } from "firebase-admin/firestore";
import * as fs from "fs";
import * as path from "path";

const FUNCTIONS_BASE =
  "http://127.0.0.1:5001/demo-proops-test/southamerica-east1/api";

let cachedCronSecret: string | null = null;

/**
 * Resolve the CRON_SECRET the Functions emulator loaded by replicating its
 * env-file precedence (.env → .env.demo-proops-test → .env.local). Mirrors
 * the resolveCronSecret() helper in tests/e2e/billing/whatsapp-overage.spec.ts.
 */
function resolveCronSecret(): string {
  if (cachedCronSecret !== null) return cachedCronSecret;
  const envFiles = [
    "apps/functions/.env",
    "apps/functions/.env.demo-proops-test",
    "apps/functions/.env.local",
  ];
  let resolved = "test-cron-secret";
  for (const relPath of envFiles) {
    try {
      const content = fs.readFileSync(path.join(process.cwd(), relPath), "utf-8");
      const match = content.match(/^CRON_SECRET=(.+)$/m);
      if (match) resolved = match[1].trim();
    } catch {
      // file not found — skip
    }
  }
  cachedCronSecret = resolved;
  return resolved;
}

/**
 * Hit the in-memory tenant-plan LRU cache invalidation endpoint so the
 * backend re-reads tenant state from Firestore on the next request.
 *
 * Replaces the racy 6s waitForCacheExpiry() sleep used previously. Best-effort:
 * any network/HTTP failure is logged but not thrown so test cleanup still runs.
 */
export async function invalidateBackendTenantPlanCache(tenantId?: string): Promise<void> {
  try {
    const res = await fetch(
      `${FUNCTIONS_BASE}/internal/debug/invalidate-tenant-plan-cache`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-secret": resolveCronSecret(),
        },
        body: JSON.stringify(tenantId ? { tenantId } : {}),
      },
    );
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(
        `[billing fixture] cache-bust returned ${res.status} for tenant=${tenantId || "all"}`,
      );
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[billing fixture] cache-bust request failed for tenant=${tenantId || "all"}:`,
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Seeds billing state for a tenant in the Firestore emulator.
 * Writes the plan and subscriptionStatus to tenants/{tenantId}.
 * Optionally seeds proposal usage count for the current month.
 */
export async function seedBillingState(
  db: Firestore,
  tenantId: string,
  plan: "free" | "pro",
  proposalsCreated?: number,
): Promise<void> {
  const subscriptionStatus = plan === "pro" ? "active" : "free";

  await db.collection("tenants").doc(tenantId).set(
    { plan, subscriptionStatus },
    { merge: true },
  );

  if (proposalsCreated !== undefined) {
    const monthId = new Date().toISOString().slice(0, 7);
    const period = buildCurrentMonthPeriod();

    await db
      .collection("tenant_usage")
      .doc(tenantId)
      .collection("months")
      .doc(monthId)
      .set({
        proposalsCreated,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        resetAt: period.resetAt,
        updatedAt: new Date().toISOString(),
      });
  }

  // Backend caches tenant plan in an in-memory LRU. After mutating Firestore
  // we MUST invalidate the cache so the next request reads fresh state.
  await invalidateBackendTenantPlanCache(tenantId);
}

/**
 * Removes billing-related fields from the tenant doc and deletes the current
 * month's usage document, restoring the tenant to its default unseeded state.
 */
export async function restoreTenantState(
  db: Firestore,
  tenantId: string,
): Promise<void> {
  await db.collection("tenants").doc(tenantId).update({
    plan: admin.firestore.FieldValue.delete(),
    planTier: admin.firestore.FieldValue.delete(),
    subscriptionStatus: admin.firestore.FieldValue.delete(),
    stripeSubscriptionId: admin.firestore.FieldValue.delete(),
    cancelAtPeriodEnd: admin.firestore.FieldValue.delete(),
    subscription: admin.firestore.FieldValue.delete(),
  });

  const monthId = new Date().toISOString().slice(0, 7);
  const usageRef = db
    .collection("tenant_usage")
    .doc(tenantId)
    .collection("months")
    .doc(monthId);

  const snap = await usageRef.get();
  if (snap.exists) {
    await usageRef.delete();
  }

  // Drop the in-memory tenant-plan cache so the next test starts with a
  // clean read from Firestore (replaces the racy 6s waitForCacheExpiry).
  await invalidateBackendTenantPlanCache(tenantId);
}

function buildCurrentMonthPeriod(): {
  periodStart: string;
  periodEnd: string;
  resetAt: string;
} {
  const now = new Date();
  const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return {
    periodStart: startDate.toISOString(),
    periodEnd: endDate.toISOString(),
    resetAt: endDate.toISOString(),
  };
}

export interface SeedBillingExtendedOptions {
  tenantId: string;
  // top-level legacy fields (read by useAuth() / SubscriptionGuard fallback)
  subscriptionStatus: "active" | "past_due" | "canceled" | "trialing";
  cancelAtPeriodEnd?: boolean;
  // canonical Phase 19 subscription.* map fields
  subscriptionMap?: {
    status: "active" | "past_due" | "canceled" | "trialing";
    cancelAtPeriodEnd?: boolean;
    cancelAt?: string | null;       // ISO date string, e.g. "2026-06-15T00:00:00.000Z"
    pastDueSince?: string | null;   // ISO date string
  };
  // optional: also write the same fields onto users/{uid} (auth-provider reads from user doc)
  userId?: string;
}

/**
 * Seeds extended billing state for Phase 20 testing.
 * Writes both legacy top-level fields and canonical Phase 19 subscription.* map fields.
 * Use restoreTenantState to clean up after tests.
 */
export async function seedBillingStateExtended(
  db: Firestore,
  opts: SeedBillingExtendedOptions,
): Promise<void> {
  const tenantPatch: Record<string, unknown> = {
    plan: "pro",
    subscriptionStatus: opts.subscriptionStatus,
  };
  if (opts.cancelAtPeriodEnd !== undefined) {
    tenantPatch.cancelAtPeriodEnd = opts.cancelAtPeriodEnd;
  }
  if (opts.subscriptionMap) {
    tenantPatch.subscription = {
      status: opts.subscriptionMap.status,
      ...(opts.subscriptionMap.cancelAtPeriodEnd !== undefined && {
        cancelAtPeriodEnd: opts.subscriptionMap.cancelAtPeriodEnd,
      }),
      ...(opts.subscriptionMap.cancelAt !== undefined && {
        cancelAt: opts.subscriptionMap.cancelAt,
      }),
      ...(opts.subscriptionMap.pastDueSince !== undefined && {
        pastDueSince: opts.subscriptionMap.pastDueSince,
      }),
    };
    // Mirror pastDueSince to root: production writers (stripeWebhook) store it at root,
    // and readers (billing-status route, subscription-blocked layout) only check root.
    if (opts.subscriptionMap.pastDueSince !== undefined) {
      tenantPatch.pastDueSince = opts.subscriptionMap.pastDueSince;
    }
  }
  await db.collection("tenants").doc(opts.tenantId).set(tenantPatch, { merge: true });

  if (opts.userId) {
    const userPatch: Record<string, unknown> = {
      subscriptionStatus: opts.subscriptionStatus,
    };
    if (opts.cancelAtPeriodEnd !== undefined) {
      userPatch.cancelAtPeriodEnd = opts.cancelAtPeriodEnd;
    }
    if (opts.subscriptionMap) {
      userPatch.subscription = tenantPatch.subscription;
    }
    await db.collection("users").doc(opts.userId).set(userPatch, { merge: true });
  }

  // Cache-bust so the freshly seeded tenant state is visible to the backend.
  await invalidateBackendTenantPlanCache(opts.tenantId);
}
