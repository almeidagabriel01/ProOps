import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { logger } from "../lib/logger";

const BATCH_SIZE = 400;

// Mirror fields under tenants/{id}.subscription that no reader consumes.
// Written defensively by the previous syncTenantPlanBillingSnapshot
// implementation as a "single source of truth" experiment; the new policy is
// to keep only root-level canonical fields. Removing these reduces document
// size and eliminates the desync class of bug that hit Lyft Connect.
const NESTED_FIELDS_TO_DELETE = [
  "subscription.status",
  "subscription.stripePriceId",
  "subscription.stripeSubscriptionId",
  "subscription.stripeCustomerId",
  "subscription.currentPeriodEnd",
  "subscription.currentPeriodStart",
  "subscription.cancelAtPeriodEnd",
  "subscription.cancelAt",
  "subscription.pastDueSince",
  "subscription.plan",
  "subscription.scheduledPlan",
  "subscription.scheduledPlanAt",
  "subscription.scheduledPlanReason",
  "subscription.syncedAt",
  "subscription.lastEventId",
  "subscription.unitAmount",
  "subscription.currency",
  "subscription.billingInterval",
] as const;

// Root-level legacy fields. priceId is the pre-Apr/2025 name for
// stripePriceId; trial* are leftovers from the removed free-trial flow.
const ROOT_LEGACY_FIELDS_TO_DELETE = [
  "priceId",
  "trialEndsAt",
  "trialUsedAt",
  "trialPlanTier",
  "trialReservedAt",
] as const;

export interface CleanupBillingRedundantFieldsResult {
  scanned: number;
  updated: number;
  batches: number;
  inconsistentFreePaying: string[]; // tenants with subscriptionStatus="active" AND plan="free"
}

/**
 * One-shot migration: removes mirror-fields under tenants/{id}.subscription
 * and root-level legacy fields (priceId, trial*). Idempotent — safe to
 * re-run.
 *
 * Does NOT auto-fix tenants where plan="free" but subscriptionStatus="active"
 * (the Lyft Connect class of bug). It lists them in the response so an admin
 * can review and fix manually — auto-promoting them could grant unwanted
 * paid-tier access to genuinely free accounts whose status field was set
 * incorrectly.
 */
export async function cleanupBillingRedundantFields(): Promise<CleanupBillingRedundantFieldsResult> {
  const db = getFirestore();
  const snap = await db.collection("tenants").get();

  let scanned = 0;
  let updated = 0;
  let batches = 0;
  let batch = db.batch();
  let pending = 0;
  const inconsistentFreePaying: string[] = [];

  for (const doc of snap.docs) {
    scanned += 1;
    const data = doc.data() as Record<string, unknown>;

    const plan = String(data.plan ?? "").toLowerCase();
    const subscriptionStatus = String(data.subscriptionStatus ?? "").toLowerCase();
    if (plan === "free" && subscriptionStatus === "active") {
      inconsistentFreePaying.push(doc.id);
    }

    const patch: Record<string, FirebaseFirestore.FieldValue> = {};

    // Nested subscription.* deletions — only delete if the nested map has
    // that specific key, otherwise FieldValue.delete on an absent path is
    // a no-op but still counts as a write.
    const subscription = (data.subscription ?? {}) as Record<string, unknown>;
    for (const path of NESTED_FIELDS_TO_DELETE) {
      const key = path.slice("subscription.".length);
      if (subscription[key] !== undefined) {
        patch[path] = FieldValue.delete();
      }
    }

    for (const field of ROOT_LEGACY_FIELDS_TO_DELETE) {
      if (data[field] !== undefined) {
        patch[field] = FieldValue.delete();
      }
    }

    if (Object.keys(patch).length === 0) continue;

    batch.update(doc.ref, patch);
    updated += 1;
    pending += 1;
    if (pending >= BATCH_SIZE) {
      await batch.commit();
      batches += 1;
      batch = db.batch();
      pending = 0;
    }
  }

  if (pending > 0) {
    await batch.commit();
    batches += 1;
  }

  logger.info("cleanupBillingRedundantFields complete", {
    scanned,
    updated,
    batches,
    inconsistentFreePayingCount: inconsistentFreePaying.length,
  });
  return { scanned, updated, batches, inconsistentFreePaying };
}
