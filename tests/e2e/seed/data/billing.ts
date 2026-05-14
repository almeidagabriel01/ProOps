import * as admin from "firebase-admin";
import type { Firestore } from "firebase-admin/firestore";

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
}
