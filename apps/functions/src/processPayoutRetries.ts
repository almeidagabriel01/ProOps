import { onSchedule } from "firebase-functions/v2/scheduler";
import { SCHEDULE_OPTIONS } from "./deploymentConfig";
import { db } from "./init";
import { executeTransfer } from "./api/services/payout-transfer.service";
import { logger } from "./lib/logger";

export const processPayoutRetries = onSchedule(
  {
    ...SCHEDULE_OPTIONS,
    schedule: "every 1 hours",
    timeoutSeconds: 300,
    memory: "256MiB",
  },
  async () => {
    const now = new Date().toISOString();
    const snap = await db
      .collection("payout_attempts")
      .where("status", "==", "pending_balance")
      .where("nextRetryAt", "<=", now)
      .limit(100)
      .get();

    logger.info("processPayoutRetries: processing attempts", { count: snap.size });

    for (const doc of snap.docs) {
      await executeTransfer(doc.id).catch((err) => {
        logger.error("processPayoutRetries: error for attempt", {
          attemptId: doc.id,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }

    logger.info("processPayoutRetries: done", { processed: snap.size });
  },
);
