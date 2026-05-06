/**
 * Unit tests for whatsapp-eligibility helpers.
 *
 * tenantPlanAllowsWhatsApp():
 *  - Returns true for enterprise tier (plan-based)
 *  - Returns true when whatsapp_addon doc is active (addon-based)
 *  - Returns false for non-enterprise tiers without active addon
 *  - Returns false for empty tenantId
 *  - Returns false when profile resolution throws (falls back to addon check)
 */

jest.mock("../../init", () => ({ db: {}, auth: {}, adminApp: {} }));
jest.mock("../logger", () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock("../security-observability", () => ({
  logSecurityEvent: jest.fn(),
  incrementSecurityCounter: jest.fn(),
  writeSecurityAuditEvent: jest.fn(),
}));

import { clearTenantPlanCache, setTenantPlanCacheForTest } from "../tenant-plan-policy";
import { tenantPlanAllowsWhatsApp } from "../whatsapp-eligibility";
import type { TenantPlanProfile } from "../tenant-plan-policy";

function makeProfile(tier: TenantPlanProfile["tier"]): TenantPlanProfile {
  return {
    tenantId: "t1",
    tier,
    limits: {
      maxProposalsPerMonth: -1,
      maxWallets: -1,
      maxUsers: -1,
      storageQuotaMB: -1,
      maxSpreadsheets: -1,
    },
    subscriptionStatus: "active",
    source: "tenant.plan",
  };
}

function mockAddonDoc(exists: boolean, status?: string) {
  const { db } = require("../../init") as { db: any };
  db.collection = jest.fn().mockReturnValue({
    doc: jest.fn().mockReturnValue({
      get: jest.fn().mockResolvedValue({
        exists,
        data: () => (exists ? { status: status ?? "active" } : undefined),
      }),
    }),
  });
}

const TENANT = "tenant-whatsapp-test";

afterEach(() => {
  clearTenantPlanCache(TENANT);
  jest.clearAllMocks();
});

describe("tenantPlanAllowsWhatsApp", () => {
  test("returns false for empty tenantId", async () => {
    expect(await tenantPlanAllowsWhatsApp("")).toBe(false);
  });

  test("returns true for enterprise tier (plan-based, no addon needed)", async () => {
    setTenantPlanCacheForTest(TENANT, makeProfile("enterprise"));
    // Addon doc should not be queried — no mock needed for db here.
    // If it is queried and db is unmocked, it will throw — which would fail the test.
    expect(await tenantPlanAllowsWhatsApp(TENANT)).toBe(true);
  });

  test("returns true for pro tier with active whatsapp_addon", async () => {
    setTenantPlanCacheForTest(TENANT, makeProfile("pro"));
    mockAddonDoc(true, "active");
    expect(await tenantPlanAllowsWhatsApp(TENANT)).toBe(true);
  });

  test("returns false for pro tier with cancelled whatsapp_addon", async () => {
    setTenantPlanCacheForTest(TENANT, makeProfile("pro"));
    mockAddonDoc(true, "cancelled");
    expect(await tenantPlanAllowsWhatsApp(TENANT)).toBe(false);
  });

  test("returns false for starter tier without active addon", async () => {
    setTenantPlanCacheForTest(TENANT, makeProfile("starter"));
    mockAddonDoc(false);
    expect(await tenantPlanAllowsWhatsApp(TENANT)).toBe(false);
  });

  test("returns false for free tier without active addon", async () => {
    setTenantPlanCacheForTest(TENANT, makeProfile("free"));
    mockAddonDoc(false);
    expect(await tenantPlanAllowsWhatsApp(TENANT)).toBe(false);
  });

  test("falls back to addon check when profile resolution throws", async () => {
    // No cache — db.collection mock will throw on tenants query to simulate
    // profile resolution failure, but addon query succeeds.
    clearTenantPlanCache(TENANT);
    const { db } = require("../../init") as { db: any };

    let callCount = 0;
    db.collection = jest.fn().mockImplementation((col: string) => {
      callCount++;
      if (col === "tenants" && callCount <= 2) {
        // First call: tenants/{id}.get() — throw to simulate failure
        return {
          doc: jest.fn().mockReturnValue({
            get: jest.fn().mockRejectedValue(new Error("Firestore unavailable")),
          }),
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          get: jest.fn().mockRejectedValue(new Error("Firestore unavailable")),
        };
      }
      // Subsequent call: addons/{id}.get() — return active addon
      return {
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ status: "active" }),
          }),
        }),
      };
    });

    const result = await tenantPlanAllowsWhatsApp(TENANT);
    expect(result).toBe(true);
  });
});
