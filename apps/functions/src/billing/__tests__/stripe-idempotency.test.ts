/**
 * BILL-08 — Stripe webhook idempotency verification.
 *
 * SCOPE NOTE (locked in Plan 01 19-01-PLAN.md objective + ratified by user revision):
 * Phase 19 BILL-08 is VERIFICATION-ONLY. The existing db.runTransaction() in
 * beginStripeEventProcessing already prevents the cross-instance race
 * (see apps/functions/src/stripe/stripeWebhook.ts lines 445-479).
 *
 * Plan 02 Task 2 promoted beginStripeEventProcessing to a named export so
 * this integration test can call it twice with the same eventId on the
 * primary branch — no Firestore-doc-only fallback is needed.
 *
 * The 5-minute stuck-processing window in shouldSkipStripeEventRecord
 * (lines 309-327) is ACCEPTED RISK for Phase 19. Stripe's retry schedule
 * (typically 1+ hour between retries) far exceeds the 5-minute window, so
 * a crashed-mid-processing event will be retried by Stripe AFTER the
 * window expires — eventual recovery is acceptable. Hardening this window
 * (e.g., shorter timeout, dead-letter queue) is deferred to a future phase.
 */

import { shouldSkipStripeEventRecord, beginStripeEventProcessing } from "../../stripe/stripeWebhook";

describe("Stripe webhook idempotency (BILL-08) — unit", () => {
  it("returns false when state is undefined (first-ever event)", () => {
    expect(shouldSkipStripeEventRecord(undefined)).toBe(false);
  });

  it("returns true when status='processed' regardless of timestamp", () => {
    const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    expect(shouldSkipStripeEventRecord({ status: "processed", lastReceivedAt: yearAgo })).toBe(true);
    expect(shouldSkipStripeEventRecord({ status: "processed", lastReceivedAt: new Date().toISOString() })).toBe(true);
  });

  it("returns true when status='processing' within the 5-minute window", () => {
    const thirtySecAgo = new Date(Date.now() - 30 * 1000).toISOString();
    expect(shouldSkipStripeEventRecord({ status: "processing", lastReceivedAt: thirtySecAgo })).toBe(true);
  });

  it("returns false when status='processing' beyond the 5-minute window (accepted-risk fallback)", () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect(shouldSkipStripeEventRecord({ status: "processing", lastReceivedAt: tenMinAgo })).toBe(false);
  });

  it("returns false when status='failed' (failed events are retryable)", () => {
    expect(shouldSkipStripeEventRecord({ status: "failed", lastReceivedAt: new Date().toISOString() })).toBe(false);
  });
});

/**
 * Integration test — requires Firestore emulator.
 * Skipped automatically when FIRESTORE_EMULATOR_HOST is unset.
 *
 * PRIMARY BRANCH ONLY: imports beginStripeEventProcessing directly (Plan 02 Task 2
 * promoted it to a named export). NO fallback path. If the import is missing,
 * Jest fails during module load — the desired loud failure.
 *
 * Test driver:
 *   1. begin(synthEvent)              → expect "process"
 *   2. write status:"processed" to stripe_events/{eventId} (simulates finalize)
 *   3. snapshot the doc
 *   4. begin(synthEvent) again        → expect "skip"
 *   5. snapshot the doc again
 *   6. assert second snapshot.status === "processed" (no re-execution mutated state)
 */
const RUN_INTEGRATION = !!process.env.FIRESTORE_EMULATOR_HOST;
const itIfEmulator = RUN_INTEGRATION ? it : it.skip;

describe("Stripe webhook idempotency (BILL-08) — integration", () => {
  itIfEmulator(
    "duplicate event.id: first call processes, second call skips with no business-logic re-execution",
    async () => {
      const { db } = await import("../../init");
      const eventId = `evt_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const synthEvent = {
        id: eventId,
        type: "customer.subscription.updated",
        livemode: false,
      } as never; // synthetic event; only `id`, `type`, `livemode` are read by beginStripeEventProcessing

      // 1. First call: should write status="processing" inside the transaction and return "process".
      const first = await beginStripeEventProcessing(synthEvent);
      expect(first).toBe("process");

      // 2. Simulate production's finalize step (status -> "processed").
      //    finalizeStripeEventProcessing is file-private; we write the doc directly to the same shape.
      await db.collection("stripe_events").doc(eventId).set(
        {
          status: "processed",
          lastProcessedAt: new Date().toISOString(),
        },
        { merge: true },
      );

      // 3. Snapshot the doc after first-call-and-finalize.
      const eventDocAfterFirstCallAndFinalize = (
        await db.collection("stripe_events").doc(eventId).get()
      ).data() as { status: string; lastProcessedAt?: string } | undefined;
      expect(eventDocAfterFirstCallAndFinalize?.status).toBe("processed");

      // 4. Second call with the SAME event.id: should return "skip" because shouldSkipStripeEventRecord
      //    sees status="processed" and short-circuits inside the transaction.
      const second = await beginStripeEventProcessing(synthEvent);
      expect(second).toBe("skip");

      // 5. Snapshot the doc after the second call.
      const eventDocAfterSecondCall = (
        await db.collection("stripe_events").doc(eventId).get()
      ).data() as { status: string; lastProcessedAt?: string } | undefined;

      // 6. Core BILL-08 assertion: second call did NOT re-execute business logic.
      //    Status remains "processed"; lastProcessedAt is unchanged from the snapshot taken
      //    after the simulated finalize. (The transaction inside beginStripeEventProcessing
      //    short-circuits BEFORE writing status:"processing", so neither status nor
      //    lastProcessedAt should change.)
      expect(eventDocAfterSecondCall?.status).toBe("processed");
      expect(eventDocAfterSecondCall?.lastProcessedAt).toBe(
        eventDocAfterFirstCallAndFinalize?.lastProcessedAt,
      );

      // Cleanup
      await db.collection("stripe_events").doc(eventId).delete();
    },
    15_000,
  );
});
