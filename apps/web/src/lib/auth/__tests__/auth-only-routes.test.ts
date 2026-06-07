import { describe, it, expect } from "vitest";
import { isAuthOnlyRoute } from "../auth-only-routes";

describe("isAuthOnlyRoute", () => {
  // Regression: the e-mail confirmation handler `/verify?code=...` was NOT in
  // the auth-only list, so it fell into the protected branch and rendered the
  // "Confirmação de e-mail pendente" screen for a logged-in-but-unverified
  // user — applyActionCode never ran and the e-mail could never be confirmed.
  describe("/verify (email confirmation handler)", () => {
    it("treats /verify as auth-only (not protected)", () => {
      expect(isAuthOnlyRoute("/verify")).toBe(true);
    });

    it("treats /verify subpaths as auth-only", () => {
      expect(isAuthOnlyRoute("/verify/anything")).toBe(true);
    });
  });

  describe("other auth-only routes stay exempt", () => {
    it.each([
      "/login",
      "/register",
      "/forgot-password",
      "/privacy",
      "/terms",
      "/data-deletion",
      "/cookies",
      "/email-verification-pending",
      "/subscribe",
      "/subscribe/plans",
      "/checkout-success",
      "/auth",
      "/auth/action",
      "/403",
      "/subscription-blocked",
      "/subscription-blocked/plans",
      "/share/abc123",
    ])("returns true for %s", (path) => {
      expect(isAuthOnlyRoute(path)).toBe(true);
    });
  });

  describe("protected app routes are NOT auth-only", () => {
    it.each([
      "/dashboard",
      "/proposals",
      "/proposals/new",
      "/transactions",
      "/contacts",
      "/products",
      "/settings",
      "/profile",
      "/team",
      "/admin",
      "/",
    ])("returns false for %s", (path) => {
      expect(isAuthOnlyRoute(path)).toBe(false);
    });
  });
});
