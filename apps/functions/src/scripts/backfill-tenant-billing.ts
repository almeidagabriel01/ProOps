/**
 * One-shot backfill: copies currentPeriodEnd + subscriptionStatus from
 * users/{uid} → tenants/{tenantId} for every user with a Stripe subscription.
 *
 * Run manually:
 *   cd apps/functions
 *   npx tsx src/scripts/backfill-tenant-billing.ts
 *
 * Idempotent — safe to re-run. Only writes when values actually diverge.
 */
import { db } from "../init";

async function main(): Promise<void> {
  console.log("=== backfill-tenant-billing: starting ===");

  const usersSnap = await db
    .collection("users")
    .where("stripeSubscriptionId", "!=", null)
    .get();

  console.log(`Found ${usersSnap.size} users with a Stripe subscription`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const userDoc of usersSnap.docs) {
    const userData = userDoc.data();
    const tenantId: string = userData.tenantId || userData.companyId || "";

    if (!tenantId) {
      console.warn(`User ${userDoc.id}: no tenantId — skipping`);
      skipped++;
      continue;
    }

    const userPeriodEnd: string = String(userData.currentPeriodEnd || "").trim();
    const userStatus: string = String(userData.subscriptionStatus || "").trim();

    if (!userPeriodEnd && !userStatus) {
      skipped++;
      continue;
    }

    try {
      const tenantRef = db.collection("tenants").doc(tenantId);
      const tenantSnap = await tenantRef.get();

      if (!tenantSnap.exists) {
        console.warn(`Tenant ${tenantId} (user ${userDoc.id}): doc not found — skipping`);
        skipped++;
        continue;
      }

      const tenantData = tenantSnap.data() as Record<string, unknown>;
      const tenantPeriodEnd = String(tenantData.currentPeriodEnd || "").trim();
      const tenantStatus = String(tenantData.subscriptionStatus || "").trim();

      const periodEndChanged = userPeriodEnd && userPeriodEnd !== tenantPeriodEnd;
      const statusChanged = userStatus && userStatus !== tenantStatus;

      if (!periodEndChanged && !statusChanged) {
        skipped++;
        continue;
      }

      const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (periodEndChanged) patch.currentPeriodEnd = userPeriodEnd;
      if (statusChanged) patch.subscriptionStatus = userStatus;

      console.log(`Tenant ${tenantId} (user ${userDoc.id}):`);
      if (periodEndChanged) {
        console.log(`  currentPeriodEnd: ${tenantPeriodEnd || "(none)"} → ${userPeriodEnd}`);
      }
      if (statusChanged) {
        console.log(`  subscriptionStatus: ${tenantStatus || "(none)"} → ${userStatus}`);
      }

      await tenantRef.set(patch, { merge: true });
      updated++;
    } catch (err) {
      console.error(`Error processing tenant ${tenantId} (user ${userDoc.id}):`, err);
      errors++;
    }
  }

  console.log("=== backfill-tenant-billing: done ===");
  console.log(`  updated: ${updated}, skipped: ${skipped}, errors: ${errors}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
