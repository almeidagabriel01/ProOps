/**
 * Unit tests for tenant-plan-policy helpers.
 *
 * Tests focus on:
 *  - compareTiers()  — pure, no I/O
 *  - normalizePlanTier() — pure, no I/O
 *  - getTenantPlanProfile() — requires Firestore mock; tests the scheduled-plan
 *    deferral path added in this session
 */

// Mock Firebase init before any imports that transitively require it.
jest.mock("../../init", () => ({ db: {}, auth: {}, adminApp: {} }));

// Mock security-observability so telemetry calls are no-ops in tests.
jest.mock("../security-observability", () => ({
  logSecurityEvent: jest.fn(),
  incrementSecurityCounter: jest.fn(),
  writeSecurityAuditEvent: jest.fn(),
}));

import { Timestamp } from "firebase-admin/firestore";
import {
  compareTiers,
  normalizePlanTier,
  getTenantPlanProfile,
  clearTenantPlanCache,
  evaluateSubscriptionStatusAccess,
  TenantPlanTier,
} from "../tenant-plan-policy";

// ── compareTiers ──────────────────────────────────────────────────────────────

describe("compareTiers", () => {
  test("free < starter", () => expect(compareTiers("free", "starter")).toBe(-1));
  test("starter < pro", () => expect(compareTiers("starter", "pro")).toBe(-1));
  test("pro < enterprise", () => expect(compareTiers("pro", "enterprise")).toBe(-1));
  test("enterprise > pro", () => expect(compareTiers("enterprise", "pro")).toBe(1));
  test("pro = pro", () => expect(compareTiers("pro", "pro")).toBe(0));
  test("free = free", () => expect(compareTiers("free", "free")).toBe(0));
  test("enterprise > free", () => expect(compareTiers("enterprise", "free")).toBe(1));
  test("starter > free", () => expect(compareTiers("starter", "free")).toBe(1));
});

// ── normalizePlanTier ─────────────────────────────────────────────────────────

describe("normalizePlanTier", () => {
  test.each<[unknown, TenantPlanTier | null]>([
    ["free", "free"],
    ["FREE", "free"],
    ["  Pro  ", "pro"],
    ["ENTERPRISE", "enterprise"],
    ["STARTER", "starter"],
    ["unknown", null],
    [null, null],
    [undefined, null],
    ["", null],
    [42, null],
  ])("normalizePlanTier(%p) === %p", (input, expected) => {
    expect(normalizePlanTier(input)).toBe(expected);
  });
});

// ── Scheduled plan deferral in getTenantPlanProfile ───────────────────────────

/**
 * Build a minimal Firestore Timestamp-like object whose toMillis() returns
 * the given value. We use Timestamp.fromMillis() when available; in test
 * environments the firebase-admin SDK is not initialised so we fall back to
 * a plain object that satisfies the duck-type check in the resolver.
 */
function makeTimestamp(ms: number): { toMillis: () => number } {
  try {
    return Timestamp.fromMillis(ms);
  } catch {
    return { toMillis: () => ms };
  }
}

describe("getTenantPlanProfile — scheduled plan deferral", () => {
  const TENANT_ID = "tenant-sched-test";

  afterEach(() => {
    clearTenantPlanCache(TENANT_ID);
  });

  test("returns scheduledPlan tier when scheduledPlanAt is in the past", async () => {
    // Inject a cached profile that mimics a tenant doc with a past-due scheduled plan.
    // We use setTenantPlanCacheForTest to bypass the Firestore call entirely and
    // verify the resolver picks the scheduled tier.
    //
    // Because the in-memory cache bypasses resolveTenantPlanProfileUncached, we
    // instead test the deferral logic by calling getTenantPlanProfile with a
    // mocked db that returns the expected tenant doc.
    const { db } = require("../../init") as { db: Record<string, unknown> };

    const pastMs = Date.now() - 10_000; // 10 seconds ago
    const scheduledAt = makeTimestamp(pastMs);

    const tenantData = {
      plan: "pro",
      scheduledPlan: "starter",
      scheduledPlanAt: scheduledAt,
      scheduledPlanReason: "downgrade",
    };

    // Mock db.collection().doc().get()
    (db as any).collection = jest.fn().mockReturnValue({
      doc: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => tenantData,
        }),
      }),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ docs: [] }),
    });

    clearTenantPlanCache(TENANT_ID);
    const profile = await getTenantPlanProfile(TENANT_ID);

    expect(profile.tier).toBe("starter");
  });

  test("ignores scheduledPlan when scheduledPlanAt is in the future", async () => {
    const { db } = require("../../init") as { db: Record<string, unknown> };

    const futureMs = Date.now() + 86_400_000; // 24 hours from now
    const scheduledAt = makeTimestamp(futureMs);

    const tenantData = {
      plan: "pro",
      scheduledPlan: "starter",
      scheduledPlanAt: scheduledAt,
      scheduledPlanReason: "downgrade",
    };

    (db as any).collection = jest.fn().mockReturnValue({
      doc: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => tenantData,
        }),
      }),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ docs: [] }),
    });

    clearTenantPlanCache(TENANT_ID);
    const profile = await getTenantPlanProfile(TENANT_ID);

    // Should use the stored plan, not the future scheduled one.
    expect(profile.tier).toBe("pro");
  });

  test("ignores scheduledPlan when scheduledPlanAt is missing", async () => {
    const { db } = require("../../init") as { db: Record<string, unknown> };

    const tenantData = {
      plan: "enterprise",
      scheduledPlan: "free",
      scheduledPlanAt: null,
      scheduledPlanReason: "downgrade",
    };

    (db as any).collection = jest.fn().mockReturnValue({
      doc: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => tenantData,
        }),
      }),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ docs: [] }),
    });

    clearTenantPlanCache(TENANT_ID);
    const profile = await getTenantPlanProfile(TENANT_ID);

    expect(profile.tier).toBe("enterprise");
  });

  test("ignores scheduledPlan when scheduledPlan is an invalid tier", async () => {
    const { db } = require("../../init") as { db: Record<string, unknown> };

    const pastMs = Date.now() - 1_000;
    const scheduledAt = makeTimestamp(pastMs);

    const tenantData = {
      plan: "pro",
      scheduledPlan: "invalid_tier",
      scheduledPlanAt: scheduledAt,
      scheduledPlanReason: "downgrade",
    };

    (db as any).collection = jest.fn().mockReturnValue({
      doc: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => tenantData,
        }),
      }),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ docs: [] }),
    });

    clearTenantPlanCache(TENANT_ID);
    const profile = await getTenantPlanProfile(TENANT_ID);

    expect(profile.tier).toBe("pro");
  });
});

// ── evaluateSubscriptionStatusAccess ────────────────────────────────────────────

describe("evaluateSubscriptionStatusAccess", () => {
  test("empty status → allowWrite (compat for legacy tenants)", () => {
    const decision = evaluateSubscriptionStatusAccess({ subscriptionStatus: "" });
    expect(decision.allowWrite).toBe(true);
    expect(decision.reasonCode).toBe("SUBSCRIPTION_OK");
  });

  test("active → allowWrite", () => {
    const decision = evaluateSubscriptionStatusAccess({ subscriptionStatus: "active" });
    expect(decision.allowWrite).toBe(true);
    expect(decision.reasonCode).toBe("SUBSCRIPTION_OK");
  });

  test("trialing → allowWrite (7-day paid trial has full ERP access)", () => {
    const decision = evaluateSubscriptionStatusAccess({ subscriptionStatus: "trialing" });
    expect(decision.allowWrite).toBe(true);
    expect(decision.reasonCode).toBe("TRIALING_OK");
  });

  test("TRIALING uppercase is normalized → allowWrite", () => {
    const decision = evaluateSubscriptionStatusAccess({ subscriptionStatus: "TRIALING" });
    expect(decision.allowWrite).toBe(true);
    expect(decision.reasonCode).toBe("TRIALING_OK");
  });

  test("past_due within grace → allowWrite", () => {
    const decision = evaluateSubscriptionStatusAccess({
      subscriptionStatus: "past_due",
      pastDueSince: new Date().toISOString(),
      graceDays: 7,
    });
    expect(decision.allowWrite).toBe(true);
    expect(decision.reasonCode).toBe("PAST_DUE_WITHIN_GRACE");
  });

  test("past_due after grace expired → blocked", () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const decision = evaluateSubscriptionStatusAccess({
      subscriptionStatus: "past_due",
      pastDueSince: eightDaysAgo,
      graceDays: 7,
    });
    expect(decision.allowWrite).toBe(false);
    expect(decision.reasonCode).toBe("PAST_DUE_GRACE_EXPIRED");
  });

  test("canceled → blocked", () => {
    const decision = evaluateSubscriptionStatusAccess({ subscriptionStatus: "canceled" });
    expect(decision.allowWrite).toBe(false);
    expect(decision.reasonCode).toBe("SUBSCRIPTION_STATUS_BLOCKED");
  });

  test("unpaid → blocked", () => {
    const decision = evaluateSubscriptionStatusAccess({ subscriptionStatus: "unpaid" });
    expect(decision.allowWrite).toBe(false);
    expect(decision.reasonCode).toBe("SUBSCRIPTION_STATUS_BLOCKED");
  });
});
