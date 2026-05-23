import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import {
  deadlineFromTimeoutSeconds,
  processWalletCascadeJob,
  WALLET_CASCADE_JOBS_COLLECTION,
} from "./api/services/wallet-cascade-job.service";
import { logger } from "./lib/logger";

const FUNCTION_TIMEOUT_SECONDS = 540;

// Inherits region from setGlobalOptions in index.ts.
void setGlobalOptions;

/**
 * Fires whenever a wallet_cascade_jobs/{jobId} document is created or
 * updated. The processor reads the doc, executes the next stage (chunks of
 * 400), and either finishes or persists a continuation cursor before the
 * 540s timeout. If it persisted a cursor + bumped `continuationKick`, this
 * same trigger fires again on the resulting onUpdate and resumes work.
 *
 * Resume control:
 *   - status="pending"   → run / resume work
 *   - status="running"   → skip (another invocation already handling it;
 *                          continuation kicks always pause via pending)
 *   - status="completed" → skip
 *   - status="failed"    → skip (retry requires manual intervention)
 */
export const onWalletCascadeJob = onDocumentWritten(
  {
    document: `${WALLET_CASCADE_JOBS_COLLECTION}/{jobId}`,
    timeoutSeconds: FUNCTION_TIMEOUT_SECONDS,
    memory: "512MiB",
  },
  async (event) => {
    const afterSnap = event.data?.after;
    if (!afterSnap?.exists) return;

    const job = afterSnap.data() as { status?: string } | undefined;
    if (!job || job.status !== "pending") return;

    const jobId = event.params.jobId;
    logger.info("wallet_cascade_job trigger fired", { jobId });

    try {
      await processWalletCascadeJob(
        jobId,
        deadlineFromTimeoutSeconds(FUNCTION_TIMEOUT_SECONDS),
      );
    } catch (err) {
      logger.error("wallet_cascade_job trigger failed", {
        jobId,
        error: err instanceof Error ? err.message : String(err),
      });
      // Re-throw so Cloud Functions records the failure for retry/alerting.
      throw err;
    }
  },
);
