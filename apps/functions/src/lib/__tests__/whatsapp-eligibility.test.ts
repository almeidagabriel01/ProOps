/**
 * Unit tests for whatsapp-eligibility helpers.
 *
 * tenantPlanAllowsWhatsApp():
 *  - Returns true only for enterprise tier (plan-based)
 *  - Returns false for all non-enterprise tiers
 *  - Returns false for empty tenantId
 *  - Returns false when profile resolution fails
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

const TENANT = "tenant-whatsapp-test";

afterEach(() => {
  clearTenantPlanCache(TENANT);
  jest.clearAllMocks();
});

describe("tenantPlanAllowsWhatsApp", () => {
  test("returns false for empty tenantId", async () => {
    expect(await tenantPlanAllowsWhatsApp("")).toBe(false);
  });

  test("returns true for enterprise tier", async () => {
    setTenantPlanCacheForTest(TENANT, makeProfile("enterprise"));
    expect(await tenantPlanAllowsWhatsApp(TENANT)).toBe(true);
  });

  test("returns false for pro tier", async () => {
    setTenantPlanCacheForTest(TENANT, makeProfile("pro"));
    expect(await tenantPlanAllowsWhatsApp(TENANT)).toBe(false);
  });

  test("returns false for starter tier", async () => {
    setTenantPlanCacheForTest(TENANT, makeProfile("starter"));
    expect(await tenantPlanAllowsWhatsApp(TENANT)).toBe(false);
  });

  test("returns false for free tier", async () => {
    setTenantPlanCacheForTest(TENANT, makeProfile("free"));
    expect(await tenantPlanAllowsWhatsApp(TENANT)).toBe(false);
  });

  test("returns false when profile resolution fails", async () => {
    clearTenantPlanCache(TENANT);
    const { db } = require("../../init") as { db: any };
    db.collection = jest.fn().mockReturnValue({
      doc: jest.fn().mockReturnValue({
        get: jest.fn().mockRejectedValue(new Error("Firestore unavailable")),
      }),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockRejectedValue(new Error("Firestore unavailable")),
    });

    expect(await tenantPlanAllowsWhatsApp(TENANT)).toBe(false);
  });
});
