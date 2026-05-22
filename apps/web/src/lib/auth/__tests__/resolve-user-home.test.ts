import { describe, it, expect } from "vitest";
import { resolveUserHome, PAGE_ROUTE_MAP } from "../resolve-user-home";
import type { User } from "@/types";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "u1",
    uid: "u1",
    name: "Test User",
    email: "test@test.com",
    role: "admin",
    tenantId: "tenant-1",
    masterId: "u1",
    status: "active",
    createdAt: new Date().toISOString(),
    ...overrides,
  } as User;
}

describe("resolveUserHome", () => {
  it("returns landing for null user", () => {
    expect(resolveUserHome(null)).toEqual({ kind: "landing", path: "/" });
  });

  it("returns /admin for superadmin", () => {
    expect(resolveUserHome(makeUser({ role: "superadmin" }))).toEqual({ kind: "admin", path: "/admin" });
  });

  it("returns /subscription-blocked for 'canceled'", () => {
    expect(resolveUserHome(makeUser({ role: "admin", subscriptionStatus: "canceled" }))).toEqual({
      kind: "subscription-blocked",
      path: "/subscription-blocked",
    });
  });

  it("returns /subscription-blocked for 'cancelled'", () => {
    expect(resolveUserHome(makeUser({ role: "admin", subscriptionStatus: "cancelled" }))).toEqual({
      kind: "subscription-blocked",
      path: "/subscription-blocked",
    });
  });

  it("returns /subscription-blocked for 'unpaid'", () => {
    expect(resolveUserHome(makeUser({ role: "admin", subscriptionStatus: "unpaid" }))).toEqual({
      kind: "subscription-blocked",
      path: "/subscription-blocked",
    });
  });

  it("returns /subscription-blocked for 'inactive'", () => {
    expect(resolveUserHome(makeUser({ role: "admin", subscriptionStatus: "inactive" }))).toEqual({
      kind: "subscription-blocked",
      path: "/subscription-blocked",
    });
  });

  it("returns /subscription-blocked for 'payment_failed'", () => {
    expect(resolveUserHome(makeUser({ role: "admin", subscriptionStatus: "payment_failed" }))).toEqual({
      kind: "subscription-blocked",
      path: "/subscription-blocked",
    });
  });

  it("does NOT block 'past_due' (client-side grace period — server handles it)", () => {
    const result = resolveUserHome(makeUser({ role: "admin", subscriptionStatus: "past_due" }));
    expect(result.path).not.toBe("/subscription-blocked");
  });

  it("returns landing for free role (free tier never sees ERP, not even dashboard)", () => {
    expect(resolveUserHome(makeUser({ role: "free" }))).toEqual({
      kind: "landing",
      path: "/",
    });
  });

  it("returns /dashboard for admin role", () => {
    expect(resolveUserHome(makeUser({ role: "admin" }))).toEqual({ kind: "dashboard", path: "/dashboard" });
  });

  it("returns /dashboard for legacy MASTER role string (runtime data)", () => {
    // Some legacy users have role="MASTER" in Firestore — resolve-user-home handles this
    const user = makeUser({ role: "admin" as User["role"] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (user as any).role = "MASTER";
    expect(resolveUserHome(user)).toEqual({ kind: "dashboard", path: "/dashboard" });
  });

  it("returns /dashboard for member with dashboard permission", () => {
    expect(
      resolveUserHome(makeUser({ role: "member", permissions: { dashboard: { canView: true } } })),
    ).toEqual({ kind: "dashboard", path: "/dashboard" });
  });

  it("returns /crm for member with only kanban permission", () => {
    const result = resolveUserHome(makeUser({ role: "member", permissions: { kanban: { canView: true } } }));
    expect(result).toEqual({ kind: "first-allowed", path: PAGE_ROUTE_MAP.kanban });
  });

  it("returns /proposals for member with only proposals permission", () => {
    const result = resolveUserHome(makeUser({ role: "member", permissions: { proposals: { canView: true } } }));
    expect(result).toEqual({ kind: "first-allowed", path: PAGE_ROUTE_MAP.proposals });
  });

  it("returns /profile for member with only profile permission (fallback)", () => {
    const result = resolveUserHome(makeUser({ role: "member", permissions: { profile: { canView: true } } }));
    expect(result).toEqual({ kind: "first-allowed", path: "/profile" });
  });

  it("returns /profile for member with no permissions (profile is guaranteed fallback)", () => {
    const result = resolveUserHome(makeUser({ role: "member", permissions: {} }));
    expect(result.path).toBe("/profile");
  });

  it("returns landing or profile for unknown role with no permissions", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = makeUser({ role: "unknown_role" as any, permissions: {} });
    const result = resolveUserHome(user);
    expect(result.path).not.toBe("/admin");
    expect(result.path).not.toBe("/subscription-blocked");
  });
});
