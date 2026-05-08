/**
 * Phase 19 BILL-06 — Real assertions for the extended single-writer.
 * Replaces Wave 0 test.todo scaffolds from Plan 01.
 *
 * Uses manual mocks of db, tenant-plan-policy, and whatsapp-eligibility
 * so these tests run without the Firebase emulator.
 */

// ---- Mock setup (must precede imports) ----

/** Captures the subscription patch (and top-level patch) set inside the transaction */
let capturedPatch: Record<string, unknown> = {};
/** Captures the update call that writes whatsappEnabled (post-transaction) */
const postTxCalls: string[] = [];
/** Sequence log for call-order assertion */
const callSequence: string[] = [];

/** Simulates existing tenant data in Firestore */
let mockTenantData: Record<string, unknown> = {};

// Factory that builds a fresh fake db for each test
function buildFakeDb() {
  const tenantRef = {
    get: jest.fn().mockResolvedValue({
      exists: Object.keys(mockTenantData).length > 0,
      data: () => mockTenantData,
    }),
    update: jest.fn().mockImplementation((data: Record<string, unknown>) => {
      callSequence.push("tenantRef.update");
      postTxCalls.push(JSON.stringify(data));
      return Promise.resolve();
    }),
    set: jest.fn(),
  };

  const fakeTransaction = {
    get: jest.fn().mockImplementation(() => {
      callSequence.push("transaction.get");
      return Promise.resolve({
        exists: Object.keys(mockTenantData).length > 0,
        data: () => mockTenantData,
      });
    }),
    set: jest.fn().mockImplementation(
      (
        _ref: unknown,
        patch: Record<string, unknown>,
        _opts: unknown,
      ) => {
        callSequence.push("transaction.set");
        capturedPatch = { ...patch };
      },
    ),
  };

  const db = {
    collection: jest.fn().mockReturnValue({
      doc: jest.fn().mockReturnValue(tenantRef),
    }),
    runTransaction: jest
      .fn()
      .mockImplementation(async (cb: (tx: typeof fakeTransaction) => Promise<void>) => {
        callSequence.push("runTransaction.start");
        await cb(fakeTransaction);
        callSequence.push("runTransaction.end");
      }),
  };

  return { db, tenantRef, fakeTransaction };
}

jest.mock("../../init", () => {
  // Replaced per-test via mockReturnValue on db.collection
  return { db: buildFakeDb().db };
});

jest.mock("../../lib/tenant-plan-policy", () => ({
  clearTenantPlanCache: jest.fn(),
  resolvePriceToTier: jest.fn().mockReturnValue("pro"),
  normalizePlanTier: jest.fn((x: unknown) => x || null),
  compareTiers: jest.fn(),
}));

jest.mock("../../lib/whatsapp-eligibility", () => ({
  tenantPlanAllowsWhatsApp: jest.fn().mockResolvedValue(true),
}));

// ---- Imports ----

import { syncTenantPlanBillingSnapshot } from "../../stripe/stripeWebhook";
import { clearTenantPlanCache, resolvePriceToTier } from "../../lib/tenant-plan-policy";
import { tenantPlanAllowsWhatsApp } from "../../lib/whatsapp-eligibility";

// Helper to reset captured state between tests
function resetCaptures() {
  capturedPatch = {};
  postTxCalls.length = 0;
  callSequence.length = 0;
  mockTenantData = {};
}

// Dynamically replace the db mock inside the module
async function resetDb(overrideTenantData?: Record<string, unknown>) {
  if (overrideTenantData !== undefined) {
    mockTenantData = overrideTenantData;
  }
  const { db: freshDb } = buildFakeDb();
  // Replace on the already-loaded module
  const initModule = jest.requireMock("../../init") as { db: typeof freshDb };
  initModule.db = freshDb;
}

// ---- Tests ----

describe("syncTenantPlanBillingSnapshot (BILL-06 single writer)", () => {
  it("scaffold present", () => {
    expect(true).toBe(true);
  });

  beforeEach(async () => {
    resetCaptures();
    jest.clearAllMocks();
    // restore resolvePriceToTier default
    (resolvePriceToTier as jest.Mock).mockReturnValue("pro");
    (tenantPlanAllowsWhatsApp as jest.Mock).mockResolvedValue(true);
    await resetDb({});
  });

  it("writes top-level fields and subscription.* atomically in one db.runTransaction()", async () => {
    const periodEnd = new Date("2026-06-01T00:00:00Z");

    await syncTenantPlanBillingSnapshot({
      tenantId: "tenant-abc",
      subscriptionStatus: "active",
      stripePriceId: "price_pro_monthly",
      currentPeriodEnd: periodEnd,
      eventId: "evt_001",
      source: "webhook.subscription.updated",
    });

    // Top-level assertions
    expect(capturedPatch.subscriptionStatus).toBe("active");
    expect(capturedPatch.currentPeriodEnd).toBe(periodEnd.toISOString());

    // subscription.* nested map assertions
    const sub = capturedPatch.subscription as Record<string, unknown>;
    expect(sub).toBeDefined();
    expect(sub.status).toBe("active");
    expect(sub.currentPeriodEnd).toBe(periodEnd.toISOString());
    expect(typeof sub.syncedAt).toBe("string");
    expect(sub.syncedAt).not.toBe("");

    // Only ONE db.runTransaction call inside syncTenantPlanBillingSnapshot
    const runTxCalls = callSequence.filter((c) => c === "runTransaction.start");
    expect(runTxCalls).toHaveLength(1);
  });

  it("populates subscription.lastEventId when eventId is provided", async () => {
    await syncTenantPlanBillingSnapshot({
      tenantId: "tenant-abc",
      subscriptionStatus: "active",
      stripePriceId: "price_pro_monthly",
      eventId: "evt_stripe_99",
      source: "webhook.subscription.updated",
    });

    const sub = capturedPatch.subscription as Record<string, unknown>;
    expect(sub).toBeDefined();
    expect(sub.lastEventId).toBe("evt_stripe_99");
  });

  it("preserves existing subscription.* fields (merge semantics) when partial params provided", async () => {
    // Simulate existing tenant data with a subscription map
    await resetDb({
      plan: "pro",
      subscription: {
        status: "active",
        stripeCustomerId: "cus_existing",
        syncedAt: "2026-01-01T00:00:00Z",
      },
    });

    // Second call with different params — omits stripeCustomerId
    await syncTenantPlanBillingSnapshot({
      tenantId: "tenant-abc",
      subscriptionStatus: "past_due",
      eventId: "evt_002",
      source: "webhook.invoice.payment_failed",
    });

    const sub = capturedPatch.subscription as Record<string, unknown>;
    expect(sub).toBeDefined();
    expect(sub.status).toBe("past_due");
    // Existing stripeCustomerId must be preserved via merge
    expect(sub.stripeCustomerId).toBe("cus_existing");
  });

  it("clears scheduledPlan/At/Reason only when clearScheduled=true AND a tier resolves", async () => {
    await syncTenantPlanBillingSnapshot({
      tenantId: "tenant-abc",
      subscriptionStatus: "active",
      stripePriceId: "price_pro_monthly",
      clearScheduled: true,
      eventId: "evt_003",
      source: "webhook.subscription.updated",
    });

    // Top-level clears
    expect(capturedPatch.scheduledPlan).toBeNull();
    expect(capturedPatch.scheduledPlanAt).toBeNull();
    expect(capturedPatch.scheduledPlanReason).toBeNull();

    // Nested clears
    const sub = capturedPatch.subscription as Record<string, unknown>;
    expect(sub.scheduledPlan).toBeNull();
    expect(sub.scheduledPlanAt).toBeNull();
    expect(sub.scheduledPlanReason).toBeNull();
  });

  it("writes whatsappEnabled in a SECOND update outside the transaction (Pitfall 2)", async () => {
    (tenantPlanAllowsWhatsApp as jest.Mock).mockResolvedValue(false);

    await syncTenantPlanBillingSnapshot({
      tenantId: "tenant-abc",
      subscriptionStatus: "active",
      stripePriceId: "price_pro_monthly",
      eventId: "evt_004",
      source: "webhook.subscription.updated",
    });

    // whatsappEnabled must be written AFTER the transaction ends
    const txEndIdx = callSequence.indexOf("runTransaction.end");
    const updateIdx = callSequence.indexOf("tenantRef.update");

    expect(txEndIdx).toBeGreaterThan(-1);
    expect(updateIdx).toBeGreaterThan(-1);
    // update must happen AFTER the transaction completes
    expect(updateIdx).toBeGreaterThan(txEndIdx);

    // Verify the value written
    const updatePayload = JSON.parse(postTxCalls[0] || "{}") as Record<string, unknown>;
    expect(updatePayload.whatsappEnabled).toBe(false);

    // clearTenantPlanCache is called before tenantPlanAllowsWhatsApp
    expect(clearTenantPlanCache).toHaveBeenCalledWith("tenant-abc");
    expect(tenantPlanAllowsWhatsApp).toHaveBeenCalledWith("tenant-abc");
  });

  it("writes subscription.syncedAt as a non-empty ISO string on every call", async () => {
    await syncTenantPlanBillingSnapshot({
      tenantId: "tenant-abc",
      subscriptionStatus: "canceled",
      source: "webhook.subscription.deleted",
    });

    const sub = capturedPatch.subscription as Record<string, unknown>;
    expect(typeof sub.syncedAt).toBe("string");
    expect((sub.syncedAt as string).length).toBeGreaterThan(0);
    // Validate ISO format
    expect(isNaN(Date.parse(sub.syncedAt as string))).toBe(false);
  });
});
