/**
 * A2 — wallet cascade job: bounded retries.
 *
 * `attempts` is incremented on every (re)entry but, before this fix, was never
 * read or bounded. A job that never reached a terminal state — one that keeps
 * erroring, or that self-re-triggers via its own status writes — would re-run
 * until the 30-day TTL deleted it. These tests pin the ceiling and the
 * reset-on-progress that keeps it from falsely failing large cascades.
 */

jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { delete: () => ({ __delete: true }) },
  getFirestore: jest.fn(),
}));

import {
  processWalletCascadeJob,
  type ProcessWalletCascadeDeps,
  type WalletCascadeJob,
  type WalletCascadeContinuationCursor,
} from "../wallet-cascade-job.service";

function makeJob(over: Partial<WalletCascadeJob> = {}): WalletCascadeJob {
  return {
    id: "job1",
    tenantId: "t1",
    walletId: "w1",
    oldName: "Old",
    newName: "New",
    status: "pending",
    progress: { transactionsUpdated: 0, proposalsUpdated: 0 },
    attempts: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-02-01T00:00:00.000Z",
    ...over,
  };
}

interface FakeDepsOptions {
  initial: WalletCascadeJob;
  batch: ProcessWalletCascadeDeps["runBatch"];
  nowSeq?: number[];
  failUpdateWhen?: (patch: Record<string, unknown>) => boolean;
}

function makeDeps(opts: FakeDepsOptions) {
  let job: WalletCascadeJob | null = opts.initial;
  const patches: Record<string, unknown>[] = [];
  const runBatch = jest.fn(opts.batch);
  const nowQueue = [...(opts.nowSeq ?? [0])];

  const deps: ProcessWalletCascadeDeps = {
    loadJob: async () => (job ? { ...job } : null),
    updateJob: async (_jobId, patch) => {
      if (opts.failUpdateWhen?.(patch)) {
        throw new Error("firestore unavailable");
      }
      patches.push(patch);
      job = { ...(job as WalletCascadeJob), ...patch } as WalletCascadeJob;
    },
    runBatch,
    now: () => (nowQueue.length > 1 ? (nowQueue.shift() as number) : nowQueue[0]),
  };

  return { deps, getJob: () => job, patches, runBatch };
}

describe("processWalletCascadeJob — bounded retries (A2)", () => {
  it("marks the job FAILED and never re-runs it once attempts reach the ceiling", async () => {
    const { deps, getJob, runBatch } = makeDeps({
      initial: makeJob({ attempts: 5, status: "running" }),
      batch: async () => {
        throw new Error("runBatch must not be called past the ceiling");
      },
    });

    await processWalletCascadeJob("job1", Number.MAX_SAFE_INTEGER, deps);

    expect(runBatch).not.toHaveBeenCalled();
    expect(getJob()?.status).toBe("failed");
    expect(getJob()?.error).toBe("MAX_CASCADE_ATTEMPTS_EXCEEDED");
  });

  it("resets the no-progress counter to 0 after a batch commits (large cascades are not falsely failed)", async () => {
    const cursorAfter: WalletCascadeContinuationCursor = {
      stage: "transactions",
      lastDocId: "d400",
    };
    const { deps, getJob, runBatch } = makeDeps({
      // One below the ceiling: without the reset, this round's entry increment
      // would push attempts to the ceiling and the next round would be failed.
      initial: makeJob({ attempts: 4, status: "pending" }),
      // First deadline check passes (run one batch); the second forces a pause.
      nowSeq: [0, Number.MAX_SAFE_INTEGER],
      batch: async ({ onCommit }) => {
        onCommit(400);
        return cursorAfter;
      },
    });

    await processWalletCascadeJob("job1", 1000, deps);

    expect(runBatch).toHaveBeenCalledTimes(1);
    expect(getJob()?.status).toBe("pending");
    expect(getJob()?.attempts).toBe(0);
  });
});
