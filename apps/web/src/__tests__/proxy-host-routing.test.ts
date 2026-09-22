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

    // Antes da virada os subdomínios eram duplicatas do apex e saíam com
    // noindex. Com ela feita, cada host tem conteúdo próprio e entra no índice.
    it("indexes the app host now that the apex no longer duplicates it", async () => {
      const resp = await proxy(request("app.proops.com.br", "/"));
      expect(isRewrite(resp)).toBe(true);
      expect(resp.headers.get("X-Robots-Tag")).toBeNull();
    });

    /**
     * O guard do defeito: a decisão era tomada por SUPERFÍCIE, e
     * `erp.proops.com.br` resolve para a mesma do apex ("erp"), então a
     * duplicata mais literal que existe escapava do noindex. Este host não
     * passa por rewrite (o ERP serve a árvore de rotas como ela é), então o
     * cabeçalho tem que sair pelo caminho de rota pública.
     */
    it("serves the ERP on erp.proops.com.br as-is, and indexable", async () => {
      const resp = await proxy(request("erp.proops.com.br", "/"));
      expect(isRewrite(resp)).toBe(false);
      expect(resp.headers.get("X-Robots-Tag")).toBeNull();
    });

    // A virada: a raiz do apex passa a ser o site da empresa, e todo caminho
    // do ERP no apex vai com 301 para o subdomínio, preservando a query.
    it("rewrites the apex root to the company site", async () => {
      const resp = await proxy(request("proops.com.br", "/"));
      expect(isRewrite(resp)).toBe(true);
      expect(resp.headers.get("X-Robots-Tag")).toBeNull();
    });

    it("sends ERP paths on the apex to erp.proops.com.br with a 301", async () => {
      const resp = await proxy(request("proops.com.br", "/login?next=%2Fdashboard"));
      expect(resp.status).toBe(301);
      expect(resp.headers.get("location")).toBe(
        "https://erp.proops.com.br/login?next=%2Fdashboard",
      );
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
