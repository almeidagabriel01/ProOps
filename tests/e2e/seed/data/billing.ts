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
  const subscriptionStatus = plan === "pro" ? "active" : "canceled";

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
