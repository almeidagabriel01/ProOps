import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { db } from "../init";

const STORAGE_GC_QUEUE_COLLECTION = "storage_gc_queue";
const MAX_STORAGE_GC_ATTEMPTS = 8;

export type StorageGcReason =
  | "proposal_update_attachment_cleanup_failed"
  | "proposal_delete_cleanup_failed";

function sanitizeStoragePath(path: unknown): string {
  const normalized = String(path || "")
    .trim()
    .replace(/\\/g, "/");
  if (!normalized) return "";
  if (normalized.length > 1024) return "";
  if (normalized.includes("..")) return "";
  if (!normalized.startsWith("tenants/")) return "";
  return normalized;
}

function buildQueueDocId(path: string): string {
  return createHash("sha256").update(path).digest("hex");
}

export async function enqueueStorageGcPath(options: {
  path: string;
  reason: StorageGcReason;
  tenantId?: string;
  proposalId?: string;
  errorMessage?: string;
}): Promise<boolean> {
  const normalizedPath = sanitizeStoragePath(options.path);
  if (!normalizedPath) return false;

  const docRef = db
    .collection(STORAGE_GC_QUEUE_COLLECTION)
    .doc(buildQueueDocId(normalizedPath));

  await db.runTransaction(async (transaction) => {
    const queueSnap = await transaction.get(docRef);
    if (!queueSnap.exists) {
      transaction.set(docRef, {
        path: normalizedPath,
        reason: options.reason,
        status: "pending",
        attempts: 1,
        firstQueuedAt: FieldValue.serverTimestamp(),
        lastQueuedAt: FieldValue.serverTimestamp(),
        lastError: options.errorMessage || null,
        tenantId: options.tenantId || null,
        proposalId: options.proposalId || null,
      });
      return;
    }

    transaction.set(
      docRef,
      {
        status: "pending",
        attempts: FieldValue.increment(1),
        lastQueuedAt: FieldValue.serverTimestamp(),
        lastError: options.errorMessage || null,
        reason: options.reason,
        tenantId: options.tenantId || null,
        proposalId: options.proposalId || null,
      },
      { merge: true },
    );
  });

  return true;
}

export async function processStorageGcQueue(
  maxItems = 300,
): Promise<{
  processed: number;
  deleted: number;
  failed: number;
  deadLettered: number;
}> {
  const safeLimit = Math.max(1, Math.min(1000, Math.floor(maxItems)));
  const queueSnap = await db
    .collection(STORAGE_GC_QUEUE_COLLECTION)
    .where("status", "==", "pending")
    .limit(safeLimit)
    .get();

  if (queueSnap.empty) {
    return { processed: 0, deleted: 0, failed: 0, deadLettered: 0 };
  }

  const bucket = getStorage().bucket();
  let deleted = 0;
  let failed = 0;
  let deadLettered = 0;

  for (const docSnap of queueSnap.docs) {
    const data = docSnap.data() as {
      path?: unknown;
      attempts?: unknown;
    };
    const path = sanitizeStoragePath(data.path);
    const attempts = Number(data.attempts || 0);

    if (!path) {
      deadLettered += 1;
      await docSnap.ref.set(
        {
          status: "dead_letter",
          lastAttemptAt: FieldValue.serverTimestamp(),
          lastError: "INVALID_STORAGE_PATH",
        },
        { merge: true },
      );
      continue;
    }

    try {
      await bucket.file(path).delete({ ignoreNotFound: true });
      await docSnap.ref.delete();
      deleted += 1;
    } catch (error) {
      const nextAttempts = attempts + 1;
      const exhausted = nextAttempts >= MAX_STORAGE_GC_ATTEMPTS;
      if (exhausted) {
        deadLettered += 1;
      } else {
        failed += 1;
      }

      await docSnap.ref.set(
        {
          status: exhausted ? "dead_letter" : "pending",
          attempts: nextAttempts,
          lastAttemptAt: FieldValue.serverTimestamp(),
          lastError: error instanceof Error ? error.message : String(error),
        },
        { merge: true },
      );
    }
  }

  return {
    processed: queueSnap.size,
    deleted,
    failed,
    deadLettered,
  };
}
