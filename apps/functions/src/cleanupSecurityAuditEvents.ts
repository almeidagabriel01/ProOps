import { onSchedule } from "firebase-functions/v2/scheduler";
import { db } from "./init";
import { SCHEDULE_OPTIONS } from "./deploymentConfig";
import { logger } from "./lib/logger";
import { resolveSecurityAuditCollection } from "./lib/security-observability";

const BATCH_SIZE = 300;

/**
 * Deletes `security_audit_events` whose `expiresAt` (ISO string) is in the past.
 * Retention is controlled per-document at write time via
 * `SECURITY_AUDIT_RETENTION_DAYS` (see security-observability.ts).
 *
 * Idempotent: re-running only ever deletes already-expired documents. Documents
 * written before retention was introduced have no `expiresAt` and are left
 * untouched (the `<=` filter excludes missing fields).
 */
export async function runCleanupSecurityAuditEvents(): Promise<{
  totalDeleted: number;
  batchesCommitted: number;
}> {
  const collection = resolveSecurityAuditCollection();
  const nowIso = new Date().toISOString();

  let totalDeleted = 0;
  let batchesCommitted = 0;

  while (true) {
    const snap = await db
      .collection(collection)
      .where("expiresAt", "<=", nowIso)
      .orderBy("expiresAt")
      .limit(BATCH_SIZE)
      .get();

    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    batchesCommitted += 1;
    totalDeleted += snap.size;

    if (snap.size < BATCH_SIZE) break;
  }

  return { totalDeleted, batchesCommitted };
}

/**
 * Cron 03:30 BRT: enforces the retention window on security audit events.
 */
export const cleanupSecurityAuditEvents = onSchedule(
  {
    ...SCHEDULE_OPTIONS,
    schedule: "30 3 * * *",
    timeoutSeconds: 540,
    memory: "256MiB",
  },
  async () => {
    try {
      const result = await runCleanupSecurityAuditEvents();
      logger.info("cleanupSecurityAuditEvents complete", result);
    } catch (err) {
      logger.error("cleanupSecurityAuditEvents failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  },
);
