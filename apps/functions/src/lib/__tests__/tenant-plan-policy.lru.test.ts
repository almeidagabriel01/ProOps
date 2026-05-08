/**
 * BILL-07: Real LRU eviction + TTL + clear assertions for PLAN_CACHE.
 * Phase 19 Plan 04 — replaced Wave 0 scaffold test.todo placeholders.
 */

// Mock Firebase init before any imports that transitively require it.
jest.mock("../../init", () => ({ db: {}, auth: {}, adminApp: {} }));

// Mock security-observability so telemetry calls are no-ops in tests.
jest.mock("../security-observability", () => ({
  logSecurityEvent: jest.fn(),
  incrementSecurityCounter: jest.fn(),
  writeSecurityAuditEvent: jest.fn(),
}));

import {
  setTenantPlanCacheForTest,
  hasTenantPlanCacheForTest,
  clearTenantPlanCache,
} from "../tenant-plan-policy";
import type { TenantPlanProfile } from "../tenant-plan-policy";

const fakeProfile = (id: string): TenantPlanProfile => ({
  tenantId: id,
  tier: "starter",
  limits: {
    maxProposalsPerMonth: 80,
    maxWallets: 5,
    maxUsers: 1,
    storageQuotaMB: 200,
    maxSpreadsheets: 25,
  },
  subscriptionStatus: "active",
  source: "test",
});

describe("tenant-plan-policy LRU cache (BILL-07)", () => {
  afterEach(() => clearTenantPlanCache());

  it("evicts oldest entry when 501st entry inserted", () => {
    for (let i = 0; i < 501; i++) {
      setTenantPlanCacheForTest(`t-${i}`, fakeProfile(`t-${i}`));
    }
    expect(hasTenantPlanCacheForTest("t-0")).toBe(false); // oldest evicted
    expect(hasTenantPlanCacheForTest("t-500")).toBe(true); // newest present
  });

  it("entry expires after explicit TTL passes", () => {
    jest.useFakeTimers();
    setTenantPlanCacheForTest("t-ttl", fakeProfile("t-ttl"), 1_000);
    expect(hasTenantPlanCacheForTest("t-ttl")).toBe(true);
    jest.advanceTimersByTime(2_000);
    expect(hasTenantPlanCacheForTest("t-ttl")).toBe(false);
    jest.useRealTimers();
  });

  it("clearTenantPlanCache(id) removes a single entry", () => {
    setTenantPlanCacheForTest("a", fakeProfile("a"));
    setTenantPlanCacheForTest("b", fakeProfile("b"));
    clearTenantPlanCache("a");
    expect(hasTenantPlanCacheForTest("a")).toBe(false);
    expect(hasTenantPlanCacheForTest("b")).toBe(true);
  });

  it("clearTenantPlanCache() with no arg clears all entries", () => {
    setTenantPlanCacheForTest("a", fakeProfile("a"));
    setTenantPlanCacheForTest("b", fakeProfile("b"));
    clearTenantPlanCache();
    expect(hasTenantPlanCacheForTest("a")).toBe(false);
    expect(hasTenantPlanCacheForTest("b")).toBe(false);
  });

  it("setTenantPlanCacheForTest writes through LRU and is observable via hasTenantPlanCacheForTest", () => {
    setTenantPlanCacheForTest("x", fakeProfile("x"));
    expect(hasTenantPlanCacheForTest("x")).toBe(true);
  });
});
