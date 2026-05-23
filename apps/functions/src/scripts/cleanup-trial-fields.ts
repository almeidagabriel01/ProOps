import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { logger } from "../lib/logger";

const TRIAL_FIELDS = [
  "trialEndsAt",
  "trialPlanTier",
  "trialUsedAt",
  "trialReservedAt",
] as const;

const BATCH_SIZE = 400;

export interface CleanupTrialFieldsResult {
  scanned: number;
  updated: number;
  batches: number;
}

/**
 * One-shot migration: removes all legacy trial-related fields from tenant
 * documents. Idempotent — safe to re-run.
 *
 * Why this exists: the trial flow was removed in May 2026; tenants that signed
 * up during the trial period still carry stale fields. The plan policy no
 * longer consults them, but they pollute admin views and waste storage.
 */
export async function cleanupTrialFields(): Promise<CleanupTrialFieldsResult> {
  const db = getFirestore();
  const snap = await db.collection("tenants").get();

  let scanned = 0;
  let updated = 0;
  let batches = 0;
  let batch = db.batch();
  let pendingWrites = 0;

  for (const doc of snap.docs) {
    scanned += 1;
    const data = doc.data() as Record<string, unknown>;
    const hasTrialField = TRIAL_FIELDS.some((field) => data[field] !== undefined);
    if (!hasTrialField) continue;

    const patch: Record<string, FirebaseFirestore.FieldValue> = {};
    for (const field of TRIAL_FIELDS) {
      if (data[field] !== undefined) patch[field] = FieldValue.delete();
    }
    batch.update(doc.ref, patch);
    updated += 1;
    pendingWrites += 1;

    if (pendingWrites >= BATCH_SIZE) {
      await batch.commit();
      batches += 1;
      batch = db.batch();
      pendingWrites = 0;
    }
  }

  if (pendingWrites > 0) {
    await batch.commit();
    batches += 1;
  }

  logger.info("cleanupTrialFields complete", { scanned, updated, batches });
  return { scanned, updated, batches };
}
