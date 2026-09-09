import { describe, expect, it } from "vitest";

import {
  ROTAS_LEGAIS,
  canonicalFor,
  origemDe,
  robotsPara,
  rotasDoSitemap,
  sitemapAbsoluto,
} from "../host-seo";
import { APEX_SURFACE, APEX_URL, SITE_URLS } from "../surfaces";

/**
 * The SEO half of the host policy.
 *
 * Everything here is about one question that only has a wrong answer in
 * production, months later: does each of the three domains tell a crawler
 * something DIFFERENT? A sitemap built once at build time answers no, silently,
 * and the symptom is a ranking that drifts to the wrong host.
 */

describe("sitemap por host", () => {
  it("dá a cada superfície as suas próprias rotas", () => {
    expect(rotasDoSitemap("app").map((r) => r.path)).toEqual(["/"]);
    expect(rotasDoSitemap("erp").map((r) => r.path)).toContain(
      "/automacao-residencial",
    );
    expect(rotasDoSitemap("app").map((r) => r.path)).not.toContain(
      "/automacao-residencial",
    );
  });

  it("lista as páginas legais uma vez só, no apex", () => {
    const legais = ROTAS_LEGAIS.map((r) => r.path);
    const superficies = ["institucional", "erp", "app"] as const;

    const quantasListam = superficies.filter((surface) =>
      rotasDoSitemap(surface).some((rota) => legais.includes(rota.path)),
    );

    expect(quantasListam).toEqual([APEX_SURFACE]);
  });

  it("emite URLs absolutas da origem certa", () => {
    const urls = sitemapAbsoluto("app").map((r) => r.url);
    expect(urls).toEqual([`${SITE_URLS.app}/`]);
    expect(urls.every((u) => u.startsWith("https://"))).toBe(true);
  });

  it("nunca repete uma URL", () => {
    for (const surface of ["institucional", "erp", "app"] as const) {
      const urls = sitemapAbsoluto(surface).map((r) => r.url);
      expect(new Set(urls).size).toBe(urls.length);
    }
  });
});

describe("canonical", () => {
  it("ancora as páginas legais no apex, venham de onde vierem", () => {
    for (const surface of ["institucional", "erp", "app"] as const) {
      expect(canonicalFor(surface, "/privacy")).toBe(`${APEX_URL}/privacy`);
    }
  });

  it("ignora barra final ao casar uma página legal", () => {
    expect(canonicalFor("app", "/terms/")).toBe(`${APEX_URL}/terms`);
  });

  it("mantém a raiz de cada superfície na própria origem", () => {
    expect(canonicalFor("app", "/")).toBe(`${SITE_URLS.app}/`);
  });

  /**
   * Enquanto o apex serve o ERP, `erp.proops.com.br` é duplicata: apontar o
   * canonical do ERP para lá pediria ao Google para mudar o ranking para um
   * host que está prestes a trocar de conteúdo.
   */
  it("mantém a superfície do apex canônica no apex", () => {
    expect(origemDe(APEX_SURFACE)).toBe(APEX_URL);
    expect(canonicalFor(APEX_SURFACE, "/")).toBe(`${APEX_URL}/`);
  });
});

describe("robots por host", () => {
  it("libera o apex", () => {
    const politica = robotsPara(APEX_SURFACE, "proops.com.br");
    expect(politica.allow).toBe("/");
    expect(politica.disallow).not.toContain("/");
    expect(politica.disallow).toContain("/dashboard/");
  });

  /**
   * O guard do defeito que motivou `shouldNoIndexHost`.
   *
   * A decisão era tomada comparando SUPERFÍCIE, e `erp.proops.com.br` resolve
   * para a mesma superfície do apex ("erp"), então a duplicata escapava do
   * noindex. Um crawler que a alcançasse veria a landing do ERP em dois
   * endereços, e o Google escolheria o canônico por nós.
   */
  it("fecha os dois subdomínios enquanto eles duplicam o apex", () => {
    for (const host of ["erp.proops.com.br", "app.proops.com.br"]) {
      const politica = robotsPara(host.startsWith("app") ? "app" : "erp", host);
      expect(politica.disallow).toEqual(["/"]);
      expect(politica.allow).toBe("");
    }
  });

  it("aponta cada robots para um sitemap absoluto", () => {
    const politica = robotsPara("app", "app.proops.com.br");
    expect(politica.sitemap).toBe(`${SITE_URLS.app}/sitemap.xml`);
  });
});
