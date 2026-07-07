import { describe, it, expect } from "vitest";
import { canAccessTenantPanel } from "../tenant-panel-access";

/**
 * Regression: superadmin clicking "Acessar Painel" on a free-tier tenant
 * entered the ERP, even though free accounts have no ERP access.
 */
describe("canAccessTenantPanel", () => {
  it("blocks a free-plan tenant (exact reported scenario)", () => {
    expect(
      canAccessTenantPanel({
        planId: "free",
        planName: "Gratuito",
        subscriptionStatus: "free",
      }),
    ).toBe(false);
  });

  it.each(["starter", "pro", "enterprise"])(
    "allows a paid %s tenant",
    (planId) => {
      expect(
        canAccessTenantPanel({
          planId,
          planName: planId,
          subscriptionStatus: "active",
        }),
      ).toBe(true);
    },
  );

  it("blocks free regardless of casing and whitespace in planId", () => {
    expect(canAccessTenantPanel({ planId: "  FREE " })).toBe(false);
    expect(canAccessTenantPanel({ planId: "Free" })).toBe(false);
  });

  it("blocks a tenant downgraded to free after cancellation (planId wins over status)", () => {
    expect(
      canAccessTenantPanel({
        planId: "free",
        planName: "Pro",
        subscriptionStatus: "canceled",
      }),
    ).toBe(false);
  });

  it("treats planId as authoritative: paid plan with display status 'free' is allowed", () => {
    expect(
      canAccessTenantPanel({ planId: "pro", subscriptionStatus: "free" }),
    ).toBe(true);
  });

  it("falls back to display status when planId is missing", () => {
    expect(
      canAccessTenantPanel({ planId: undefined, subscriptionStatus: "free" }),
    ).toBe(false);
    expect(
      canAccessTenantPanel({ planId: null, subscriptionStatus: "active" }),
    ).toBe(true);
  });

  it("falls back to plan label aliases when planId and status are missing", () => {
    expect(canAccessTenantPanel({ planName: "Gratuito" })).toBe(false);
    expect(canAccessTenantPanel({ planName: "grátis" })).toBe(false);
    expect(canAccessTenantPanel({ planName: "gratis" })).toBe(false);
    expect(canAccessTenantPanel({ planName: "Pro" })).toBe(true);
  });

  it("allows when no plan signal exists at all (does not lock out unknown paid rows)", () => {
    expect(canAccessTenantPanel({})).toBe(true);
  });
});
