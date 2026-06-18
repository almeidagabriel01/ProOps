import { describe, expect, it } from "vitest";
import {
  PUBLIC_MARKETING_ROUTES,
  PUBLIC_ROUTES,
  isBillingAllowedRoute,
  isPublicMarketingRoute,
  isPublicRoute,
  shouldSkipRoute,
} from "../route-access";

// Routes that MUST stay behind auth + the billing gate. If any of these ever
// classifies as public, the proxy would serve protected pages without a session.
const PROTECTED_ERP_ROUTES = [
  "/dashboard",
  "/proposals",
  "/transactions",
  "/contacts",
  "/products",
  "/team",
  "/settings",
  "/crm",
  "/wallets",
];

describe("route-access", () => {
  describe("isPublicMarketingRoute", () => {
    for (const route of PUBLIC_MARKETING_ROUTES) {
      it(`classifies ${route} as a public marketing page`, () => {
        expect(isPublicMarketingRoute(route)).toBe(true);
      });
    }

    it("matches sub-paths of a marketing route (e.g. /agendar/confirm)", () => {
      expect(isPublicMarketingRoute("/agendar/confirm")).toBe(true);
    });

    it("does not match the ERP shell pages", () => {
      for (const route of PROTECTED_ERP_ROUTES) {
        expect(isPublicMarketingRoute(route)).toBe(false);
      }
    });

    it("root '/' does not swallow other top-level paths", () => {
      expect(isPublicMarketingRoute("/dashboard")).toBe(false);
      expect(isPublicMarketingRoute("/")).toBe(true);
    });

    it("respects word boundaries (/contato must not match /contatos)", () => {
      expect(isPublicMarketingRoute("/contatos")).toBe(false);
    });
  });

  describe("isPublicRoute", () => {
    for (const route of PUBLIC_ROUTES) {
      it(`lets ${route} through without a session cookie`, () => {
        expect(isPublicRoute(route)).toBe(true);
      });
    }

    it("does NOT let ERP routes through without a session cookie", () => {
      for (const route of PROTECTED_ERP_ROUTES) {
        expect(isPublicRoute(route)).toBe(false);
      }
    });

    it("regression: /agendar is reachable without auth (was missing → /auth/refresh loop)", () => {
      expect(isPublicRoute("/agendar")).toBe(true);
    });
  });

  // The invariant that PREVENTS the whole class of bug, not just /agendar:
  // anything rendered publicly on the client (no <ProtectedRoute>) must also be
  // public at the proxy. Otherwise the proxy bounces it into /auth/refresh.
  describe("invariant: every public marketing route is also a proxy public route", () => {
    for (const route of PUBLIC_MARKETING_ROUTES) {
      it(`${route} is public on BOTH the client shell and the proxy`, () => {
        expect(isPublicMarketingRoute(route)).toBe(true);
        expect(isPublicRoute(route)).toBe(true);
      });
    }
  });

  describe("isBillingAllowedRoute", () => {
    it("exempts /subscription-blocked from the billing gate", () => {
      expect(isBillingAllowedRoute("/subscription-blocked")).toBe(true);
    });
    it("does not exempt arbitrary routes", () => {
      expect(isBillingAllowedRoute("/dashboard")).toBe(false);
    });
  });

  describe("shouldSkipRoute", () => {
    it("skips static assets and API routes", () => {
      expect(shouldSkipRoute("/_next/static/chunk.js")).toBe(true);
      expect(shouldSkipRoute("/api/backend/proposals")).toBe(true);
    });
    it("does not skip application pages", () => {
      expect(shouldSkipRoute("/dashboard")).toBe(false);
      expect(shouldSkipRoute("/agendar")).toBe(false);
    });
  });
});
