import { describe, test, expect, beforeEach } from "vitest";
import { setDemoMode, isDemoMode, isDemoBlockedMutation } from "@/lib/demo-mode";

beforeEach(() => setDemoMode(false));

describe("demo-mode flag", () => {
  test("defaults to off", () => {
    expect(isDemoMode()).toBe(false);
  });

  test("setDemoMode toggles the flag", () => {
    setDemoMode(true);
    expect(isDemoMode()).toBe(true);
    setDemoMode(false);
    expect(isDemoMode()).toBe(false);
  });
});

describe("isDemoBlockedMutation", () => {
  test("never blocks when demo mode is off", () => {
    setDemoMode(false);
    expect(isDemoBlockedMutation("POST", "/v1/products")).toBe(false);
    expect(isDemoBlockedMutation("DELETE", "/v1/proposals/x")).toBe(false);
  });

  describe("with demo mode on", () => {
    beforeEach(() => setDemoMode(true));

    test.each(["GET"])("allows %s (reads)", (method) => {
      expect(isDemoBlockedMutation(method, "/v1/products")).toBe(false);
    });

    test.each(["POST", "PUT", "DELETE", "PATCH"])(
      "blocks %s on ERP data routes",
      (method) => {
        expect(isDemoBlockedMutation(method, "/v1/products")).toBe(true);
        expect(isDemoBlockedMutation(method, "/v1/proposals/x")).toBe(true);
        expect(isDemoBlockedMutation(method, "/v1/services")).toBe(true);
        expect(isDemoBlockedMutation(method, "/v1/clients/x")).toBe(true);
      },
    );

    test.each([
      "/v1/stripe/checkout",
      "/v1/billing/x",
      "/v1/profile",
      "/v1/auth/refresh",
      "/v1/users/me",
      "/v1/tenants/abc",
    ])("allows account/billing mutation %s (so demo users can subscribe)", (path) => {
      expect(isDemoBlockedMutation("POST", path)).toBe(false);
    });
  });
});
