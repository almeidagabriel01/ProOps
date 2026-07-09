import { describe, it, expect } from "vitest";
import { resolveBillingAccess } from "../billing-access";

const NOW = new Date("2026-07-09T12:00:00Z").getTime();

describe("resolveBillingAccess", () => {
  // Regression: a churned trial is demoted to role "free" but keeps a leftover
  // "canceled" subscriptionStatus. The free/demo account must reach the ERP
  // demo — the server billing gate must NOT block it on the canceled status.
  it("allows a free account on an allowed path despite a leftover 'canceled' status", () => {
    expect(
      resolveBillingAccess({
        role: "free",
        subscriptionStatus: "canceled",
        pastDueSince: null,
        requestedPath: "/dashboard",
        nowMs: NOW,
      }),
    ).toEqual({ allowed: true, status: "free" });
  });

  it("allows a free account on other demo/allowlist paths regardless of status", () => {
    for (const path of ["/", "/proposals", "/profile", "/products/abc"]) {
      expect(
        resolveBillingAccess({
          role: "free",
          subscriptionStatus: "unpaid",
          pastDueSince: null,
          requestedPath: path,
          nowMs: NOW,
        }).allowed,
      ).toBe(true);
    }
  });

  it("blocks a free account on a non-allowlist (premium) path", () => {
    expect(
      resolveBillingAccess({
        role: "free",
        subscriptionStatus: "canceled",
        pastDueSince: null,
        requestedPath: "/transactions",
        nowMs: NOW,
      }),
    ).toEqual({ allowed: false, status: "free", reason: "free_tier_forbidden" });
  });

  it("blocks a paying (admin) account with a canceled subscription", () => {
    expect(
      resolveBillingAccess({
        role: "admin",
        subscriptionStatus: "canceled",
        pastDueSince: null,
        requestedPath: "/dashboard",
        nowMs: NOW,
      }),
    ).toEqual({ allowed: false, status: "canceled" });
  });

  it("allows active / trialing / empty status for paying roles", () => {
    for (const status of ["", "active", "trialing"]) {
      expect(
        resolveBillingAccess({
          role: "admin",
          subscriptionStatus: status,
          pastDueSince: null,
          requestedPath: "/dashboard",
          nowMs: NOW,
        }).allowed,
      ).toBe(true);
    }
  });

  it("honours the past_due grace window for paying roles", () => {
    const withinGrace = new Date("2026-07-05T12:00:00Z").toISOString(); // 4 days ago
    const expired = new Date("2026-06-30T12:00:00Z").toISOString(); // 9 days ago
    expect(
      resolveBillingAccess({
        role: "admin",
        subscriptionStatus: "past_due",
        pastDueSince: withinGrace,
        requestedPath: "/dashboard",
        nowMs: NOW,
      }).allowed,
    ).toBe(true);
    expect(
      resolveBillingAccess({
        role: "admin",
        subscriptionStatus: "past_due",
        pastDueSince: expired,
        requestedPath: "/dashboard",
        nowMs: NOW,
      }).allowed,
    ).toBe(false);
  });
});
