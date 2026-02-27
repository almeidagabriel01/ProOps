import { onSchedule } from "firebase-functions/v2/scheduler";
import { db } from "./init";
import { SCHEDULE_OPTIONS } from "./deploymentConfig";
import { processStorageGcQueue } from "./lib/storage-gc";

const SHARED_PROPOSALS_COLLECTION = "shared_proposals";
const SHARED_TRANSACTIONS_COLLECTION = "shared_transactions";
const MAX_LINKS_PER_BATCH = 250;
const MAX_LINKS_PER_COLLECTION_PER_RUN = 1500;
const MAX_STORAGE_GC_ITEMS_PER_RUN = 500;

async function cleanupExpiredLinksInCollection(
  collectionName: string,
  nowIso: string,
): Promise<number> {
  let deleted = 0;

  while (deleted < MAX_LINKS_PER_COLLECTION_PER_RUN) {
    const remaining = MAX_LINKS_PER_COLLECTION_PER_RUN - deleted;
    const batchSize = Math.min(MAX_LINKS_PER_BATCH, remaining);
    const expiredSnap = await db
      .collection(collectionName)
      .where("expiresAt", "<", nowIso)
      .limit(batchSize)
      .get();

    if (expiredSnap.empty) break;

    const batch = db.batch();
    expiredSnap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
    deleted += expiredSnap.size;

    if (expiredSnap.size < batchSize) break;
  }

  return deleted;
}

export const cleanupStorageAndSharedLinks = onSchedule(
  {
    ...SCHEDULE_OPTIONS,
    schedule: "every 6 hours",
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    const nowIso = new Date().toISOString();
    console.log("[cleanupStorageAndSharedLinks] job started", { nowIso });

    let deletedSharedProposals = 0;
    let deletedSharedTransactions = 0;

    try {
      [deletedSharedProposals, deletedSharedTransactions] = await Promise.all([
        cleanupExpiredLinksInCollection(SHARED_PROPOSALS_COLLECTION, nowIso),
        cleanupExpiredLinksInCollection(SHARED_TRANSACTIONS_COLLECTION, nowIso),
      ]);
    } catch (error) {
      console.error(
        "[cleanupStorageAndSharedLinks] failed during expired link cleanup",
        error,
      );
    }

    let gcStats = {
      processed: 0,
      deleted: 0,
      failed: 0,
      deadLettered: 0,
    };
    try {
      gcStats = await processStorageGcQueue(MAX_STORAGE_GC_ITEMS_PER_RUN);
    } catch (error) {
      console.error(
        "[cleanupStorageAndSharedLinks] failed during storage gc processing",
        error,
      );
    }

    console.log("[cleanupStorageAndSharedLinks] job finished", {
      deletedSharedProposals,
      deletedSharedTransactions,
      storageGcProcessed: gcStats.processed,
      storageGcDeleted: gcStats.deleted,
      storageGcFailed: gcStats.failed,
      storageGcDeadLettered: gcStats.deadLettered,
    });
  },
);
