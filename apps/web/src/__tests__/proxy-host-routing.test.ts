import { NextRequest } from "next/server";
import { getRewrittenUrl, isRewrite } from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";

import { proxy } from "@/proxy";

/**
 * Locks the ORDER of the rules in `proxy.ts`, which is where multi-host
 * routing is easiest to get subtly wrong. Every case here failed, or would
 * have failed, under an ordering that looks equally reasonable on paper.
 */
function request(host: string, path: string): NextRequest {
  return new NextRequest(`https://${host}${path}`, { headers: { host } });
}

describe("proxy host routing", () => {
  describe("erp.proops.com.br serves the ERP untouched", () => {
    it("does not rewrite the root", async () => {
      const resp = await proxy(request("erp.proops.com.br", "/"));
      expect(isRewrite(resp)).toBe(false);
    });

    it("does not rewrite the niche landings", async () => {
      const resp = await proxy(request("erp.proops.com.br", "/decoracao"));
      expect(isRewrite(resp)).toBe(false);
    });
  });

  describe("the new hosts rewrite only their root", () => {
    it("app.proops.com.br/ renders the app landing", async () => {
      const resp = await proxy(request("app.proops.com.br", "/"));
      expect(isRewrite(resp)).toBe(true);
      expect(getRewrittenUrl(resp)).toContain("/aplicativo");
    });

    it("keeps the query string across the rewrite", async () => {
      const resp = await proxy(request("app.proops.com.br", "/?utm_source=x"));
      expect(getRewrittenUrl(resp)).toContain("utm_source=x");
    });

    it("marks the transitional hosts noindex while the apex still serves the ERP", async () => {
      const resp = await proxy(request("app.proops.com.br", "/"));
      expect(resp.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    });

    it("leaves the apex root alone until the cutover", async () => {
      // APEX_SURFACE is still "erp", so proops.com.br must behave exactly as
      // it does today. This is the guard that the phase is additive.
      const resp = await proxy(request("proops.com.br", "/"));
      expect(isRewrite(resp)).toBe(false);
      expect(resp.headers.get("X-Robots-Tag")).toBeNull();
    });
  });

  describe("asset and API paths are decided before any host rule", () => {
    // A host rule placed above shouldSkipRoute would turn a signed Stripe
    // webhook POST into a redirect.
    it.each([
      ["/api/webhooks/stripe"],
      ["/api/auth/session"],
      ["/hero/Dashboard.png"],
    ])("passes %s straight through on every host", async (path) => {
      for (const host of [
        "proops.com.br",
        "erp.proops.com.br",
        "app.proops.com.br",
      ]) {
        const resp = await proxy(request(host, path));
        expect(isRewrite(resp)).toBe(false);
        expect(resp.status).toBe(200);
      }
    });
  });

  describe("RSC data requests follow the page they belong to", () => {
    // Next normalizes `/_next/data/<build>/dashboard.json` to `/dashboard`
    // BEFORE the proxy sees it, deliberately, so a protected page cannot be
    // read through its data route. These two cases prove host routing did not
    // break either half of that.
    it("still gates the data route of a protected page", async () => {
      const resp = await proxy(
        request("erp.proops.com.br", "/_next/data/build/dashboard.json"),
      );
      expect(resp.status).toBe(307);
      expect(resp.headers.get("location")).toContain("/auth/refresh");
    });

    it("rewrites the data route of the app landing root", async () => {
      const resp = await proxy(
        request("app.proops.com.br", "/_next/data/build/index.json"),
      );
      expect(isRewrite(resp)).toBe(true);
      expect(getRewrittenUrl(resp)).toContain("/aplicativo");
    });
  });
});
