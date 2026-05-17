import { describe, it, expect } from "vitest";
import { isPathAllowedForUser } from "../resolve-user-home";
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

describe("isPathAllowedForUser", () => {
  it("returns false for null user", () => {
    expect(isPathAllowedForUser("/dashboard", null)).toBe(false);
    expect(isPathAllowedForUser("/", null)).toBe(false);
  });

  describe("superadmin", () => {
    const user = makeUser({ role: "superadmin" });

    it("allows /admin", () => expect(isPathAllowedForUser("/admin", user)).toBe(true));
    it("allows /admin/billing", () => expect(isPathAllowedForUser("/admin/billing", user)).toBe(true));
    it("rejects /dashboard", () => expect(isPathAllowedForUser("/dashboard", user)).toBe(false));
    it("rejects /profile", () => expect(isPathAllowedForUser("/profile", user)).toBe(false));
    it("rejects /", () => expect(isPathAllowedForUser("/", user)).toBe(false));
  });

  describe("free user", () => {
    const user = makeUser({ role: "free" });

    it("allows /", () => expect(isPathAllowedForUser("/", user)).toBe(true));
    it("allows /subscribe", () => expect(isPathAllowedForUser("/subscribe", user)).toBe(true));
    it("allows /subscription-blocked", () => expect(isPathAllowedForUser("/subscription-blocked", user)).toBe(true));
    it("allows /subscribe/something (startsWith)", () => expect(isPathAllowedForUser("/subscribe/something", user)).toBe(true));
    it("rejects /profile", () => expect(isPathAllowedForUser("/profile", user)).toBe(false));
    it("rejects /dashboard", () => expect(isPathAllowedForUser("/dashboard", user)).toBe(false));
    it("rejects /transactions", () => expect(isPathAllowedForUser("/transactions", user)).toBe(false));
    it("rejects /admin", () => expect(isPathAllowedForUser("/admin", user)).toBe(false));
    it("rejects /profile?tab=overview (strip query string)", () => {
      expect(isPathAllowedForUser("/profile?tab=overview", user)).toBe(false);
    });
  });

  describe("paying admin/master", () => {
    const adminUser = makeUser({ role: "admin" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const masterUser = makeUser({ role: "admin" as any });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (masterUser as any).role = "MASTER";

    it("allows /dashboard for admin", () => expect(isPathAllowedForUser("/dashboard", adminUser)).toBe(true));
    it("allows /profile for admin", () => expect(isPathAllowedForUser("/profile", adminUser)).toBe(true));
    it("allows /transactions for admin", () => expect(isPathAllowedForUser("/transactions", adminUser)).toBe(true));
    it("rejects /admin for admin (not superadmin)", () => expect(isPathAllowedForUser("/admin", adminUser)).toBe(false));
    it("allows /dashboard for master", () => expect(isPathAllowedForUser("/dashboard", masterUser)).toBe(true));
    it("allows /profile?tab=billing for admin", () => {
      expect(isPathAllowedForUser("/profile?tab=billing", adminUser)).toBe(true);
    });
  });

  describe("member", () => {
    const user = makeUser({ role: "member" });

    it("allows /proposals", () => expect(isPathAllowedForUser("/proposals", user)).toBe(true));
    it("allows /profile", () => expect(isPathAllowedForUser("/profile", user)).toBe(true));
    it("rejects /admin", () => expect(isPathAllowedForUser("/admin", user)).toBe(false));
    it("rejects /admin/billing", () => expect(isPathAllowedForUser("/admin/billing", user)).toBe(false));
  });
});
