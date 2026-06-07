import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { logger } from "../../lib/logger";

export const WALLET_CASCADE_JOBS_COLLECTION = "wallet_cascade_jobs";
const TRANSACTIONS_COLLECTION = "transactions";
const PROPOSALS_COLLECTION = "proposals";
const BATCH_SIZE = 400;

// Leaves ~20 seconds of headroom before the 540s function timeout so the
// trigger can persist a continuation cursor and exit cleanly.
const DEADLINE_HEADROOM_MS = 20_000;

// A2: cap on consecutive runs that make no forward progress. `attempts` is
// reset to 0 whenever a batch commits, so this bounds retry storms (a stuck or
// self-re-triggering job) without penalising a large cascade that legitimately
// needs many continuation rounds.
const MAX_CASCADE_ATTEMPTS = 5;

export type WalletCascadeStage =
  | "transactions"
  | "proposals_down"
  | "proposals_inst"
  | "done";

export interface WalletCascadeProgress {
  transactionsUpdated: number;
  proposalsUpdated: number;
}

export interface WalletCascadeContinuationCursor {
  stage: WalletCascadeStage;
  lastDocId?: string;
}

export interface WalletCascadeJob {
  id: string;
  tenantId: string;
  walletId: string;
  oldName: string;
  newName: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: WalletCascadeProgress;
  attempts: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  continuationCursor?: WalletCascadeContinuationCursor;
  // Tenant-scoped TTL helper — old jobs cleaned up by cron after 30 days.
  createdAt: string;
  expiresAt: string;
}

export interface EnqueueWalletCascadeJobArgs {
  tenantId: string;
  walletId: string;
  oldName: string;
  newName: string;
}

/**
 * Creates a job document that triggers the async cascade processor.
 * Returns the job id so the caller can hand it back to the frontend
 * for live progress tracking via Firestore listener.
 */
export async function enqueueWalletCascadeJob(
  args: EnqueueWalletCascadeJobArgs,
): Promise<string> {
  const db = getFirestore();
  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const jobId = `${args.walletId}_${Date.now()}`;

  const job: WalletCascadeJob = {
    id: jobId,
    tenantId: args.tenantId,
    walletId: args.walletId,
    oldName: args.oldName,
    newName: args.newName,
    status: "pending",
    progress: { transactionsUpdated: 0, proposalsUpdated: 0 },
    attempts: 0,
    createdAt: nowIso,
    expiresAt,
  };

  await db.collection(WALLET_CASCADE_JOBS_COLLECTION).doc(jobId).set(job);
  return jobId;
}

/**
 * Firestore I/O seam for {@link processWalletCascadeJob}. Injected so the
 * control flow (attempts ceiling, continuation, failure handling) can be
 * unit-tested without the emulator. Defaults to the real Firestore-backed
 * implementation.
 */
export interface ProcessWalletCascadeDeps {
  loadJob(jobId: string): Promise<WalletCascadeJob | null>;
  updateJob(jobId: string, patch: Record<string, unknown>): Promise<void>;
  runBatch(input: {
    job: WalletCascadeJob;
    cursor: WalletCascadeContinuationCursor;
    onCommit: (delta: number) => void;
  }): Promise<WalletCascadeContinuationCursor>;
  now(): number;
}

function createFirestoreCascadeDeps(): ProcessWalletCascadeDeps {
  const db = getFirestore();
  const col = db.collection(WALLET_CASCADE_JOBS_COLLECTION);
  return {
    async loadJob(jobId) {
      const snap = await col.doc(jobId).get();
      return snap.exists ? (snap.data() as WalletCascadeJob) : null;
    },
    async updateJob(jobId, patch) {
      await col.doc(jobId).update(patch);
    },
    runBatch: (input) => runOneBatch({ db, ...input }),
    now: () => Date.now(),
  };
}

/**
 * Processes (or resumes) a cascade job. Designed to be called from a
 * Firestore onCreate/onUpdate trigger. Honours a soft deadline so the
 * function can persist progress and exit before the hard 540s limit.
 *
 * Idempotent: re-running for the same job uses the persisted cursor and
 * never double-counts (cursor advances per committed batch).
 */
export async function processWalletCascadeJob(
  jobId: string,
  deadlineMs: number,
  deps: ProcessWalletCascadeDeps = createFirestoreCascadeDeps(),
): Promise<void> {
  const job = await deps.loadJob(jobId);
  if (!job) {
    logger.warn("wallet_cascade_job not found", { jobId });
    return;
  }
  if (job.status === "completed" || job.status === "failed") {
    return;
  }

  // A2: bounded retries. `attempts` counts consecutive runs that made no
  // progress (reset to 0 on every committed batch below). Without a ceiling a
  // job that never reaches a terminal state — e.g. one that keeps erroring, or
  // whose failed-state write itself keeps failing (A1) — would re-trigger
  // itself until the 30-day TTL. The ceiling forces convergence to "failed".
  if ((job.attempts ?? 0) >= MAX_CASCADE_ATTEMPTS) {
    await markJobFailed(deps, jobId, job.progress, "MAX_CASCADE_ATTEMPTS_EXCEEDED");
    logger.error("wallet_cascade_job exceeded max attempts", {
      jobId,
      attempts: job.attempts,
    });
    return;
  }

  await deps.updateJob(jobId, {
    status: "running",
    startedAt: job.startedAt || new Date().toISOString(),
    attempts: (job.attempts ?? 0) + 1,
  });

  let cursor: WalletCascadeContinuationCursor = job.continuationCursor || {
    stage: "transactions",
  };
  let progress: WalletCascadeProgress = { ...job.progress };

  try {
    while (cursor.stage !== "done") {
      if (deps.now() >= deadlineMs) {
        await deps.updateJob(jobId, {
          status: "pending",
          progress,
          continuationCursor: cursor,
        });
        // Bump triggers another run via onUpdate (no-op if rules forbid).
        await deps.updateJob(jobId, { continuationKick: deps.now() });
        logger.info("wallet_cascade_job paused for continuation", {
          jobId,
          cursor,
          progress,
        });
        return;
      }

      cursor = await deps.runBatch({
        job,
        cursor,
        onCommit: (delta) => {
          if (cursor.stage === "transactions") {
            progress.transactionsUpdated += delta;
          } else {
            progress.proposalsUpdated += delta;
          }
        },
      });

      // A batch committed → real forward progress was made, so reset the
      // no-progress counter. A legitimately large cascade that needs many
      // continuation rounds is thus never mistaken for a stuck/looping job.
      await deps.updateJob(jobId, {
        progress,
        continuationCursor: cursor,
        attempts: 0,
      });
    }

    await deps.updateJob(jobId, {
      status: "completed",
      progress,
      completedAt: new Date().toISOString(),
      continuationCursor: FieldValue.delete(),
    });
    logger.info("wallet_cascade_job completed", { jobId, progress });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markJobFailed(deps, jobId, progress, message);
    logger.error("wallet_cascade_job failed", { jobId, error: message, progress });
    throw err;
  }
}

/**
 * Persists the terminal "failed" state best-effort (A1). If the write itself
 * fails, the job is left in its current state and will be retried — but the
 * attempts ceiling (A2) guarantees it still converges to "failed" on a later
 * run instead of retrying until the 30-day TTL. The caller still rethrows the
 * original processing error, so the failure cause is never masked by a
 * persistence error.
 */
async function markJobFailed(
  deps: ProcessWalletCascadeDeps,
  jobId: string,
  progress: WalletCascadeProgress,
  error: string,
): Promise<void> {
  try {
    await deps.updateJob(jobId, {
      status: "failed",
      progress,
      error,
      completedAt: new Date().toISOString(),
    });
  } catch (persistErr) {
    logger.error("wallet_cascade_job failed-state persist error", {
      jobId,
      error: persistErr instanceof Error ? persistErr.message : String(persistErr),
    });
  }
}

interface RunOneBatchArgs {
  db: FirebaseFirestore.Firestore;
  job: WalletCascadeJob;
  cursor: WalletCascadeContinuationCursor;
  onCommit: (delta: number) => void;
}

async function runOneBatch(
  args: RunOneBatchArgs,
): Promise<WalletCascadeContinuationCursor> {
  const { db, job, cursor, onCommit } = args;
  if (cursor.stage === "done") return cursor;
  const { collection, field } = stageConfig(cursor.stage);

  let query = db
    .collection(collection)
    .where("tenantId", "==", job.tenantId)
    .where(field, "==", job.oldName)
    .orderBy("__name__")
    .limit(BATCH_SIZE);

  if (cursor.lastDocId) {
    const lastRef = db.collection(collection).doc(cursor.lastDocId);
    query = query.startAfter(await lastRef.get());
  }

  const snap = await query.get();
  if (snap.empty) {
    return { stage: nextStage(cursor.stage) };
  }

  const batch = db.batch();
  const nowIso = new Date().toISOString();
  snap.docs.forEach((doc) => {
    batch.update(doc.ref, { [field]: job.walletId, updatedAt: nowIso });
  });
  await batch.commit();
  onCommit(snap.size);

  if (snap.size < BATCH_SIZE) {
    return { stage: nextStage(cursor.stage) };
  }
  return {
    stage: cursor.stage,
    lastDocId: snap.docs[snap.docs.length - 1].id,
  };
}

function stageConfig(stage: Exclude<WalletCascadeStage, "done">): {
  collection: string;
  field: "wallet" | "downPaymentWallet" | "installmentsWallet";
} {
  switch (stage) {
    case "transactions":
      return { collection: TRANSACTIONS_COLLECTION, field: "wallet" };
    case "proposals_down":
      return { collection: PROPOSALS_COLLECTION, field: "downPaymentWallet" };
    case "proposals_inst":
      return { collection: PROPOSALS_COLLECTION, field: "installmentsWallet" };
  }
}

function nextStage(stage: Exclude<WalletCascadeStage, "done">): WalletCascadeStage {
  switch (stage) {
    case "transactions":
      return "proposals_down";
    case "proposals_down":
      return "proposals_inst";
    case "proposals_inst":
      return "done";
  }
}

/**
 * Helper for callers (trigger / debug endpoint) to derive a deadline from a
 * function timeout, leaving DEADLINE_HEADROOM_MS for cursor persistence.
 */
export function deadlineFromTimeoutSeconds(timeoutSeconds: number): number {
  return Date.now() + timeoutSeconds * 1000 - DEADLINE_HEADROOM_MS;
}

/**
 * Deletes wallet_cascade_jobs older than `cutoffIso`. Returns count.
 * Called by the daily cleanup cron.
 */
export async function cleanupExpiredWalletCascadeJobs(): Promise<number> {
  const db = getFirestore();
  const cutoffIso = new Date().toISOString();
  let total = 0;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;

  while (true) {
    let q = db
      .collection(WALLET_CASCADE_JOBS_COLLECTION)
      .where("expiresAt", "<=", cutoffIso)
      .orderBy("expiresAt")
      .limit(BATCH_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc);

    const snap = await q.get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    total += snap.size;
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < BATCH_SIZE) break;
  }

  if (total > 0) {
    logger.info("wallet_cascade_jobs cleanup complete", { deleted: total });
  }
  return total;
}

