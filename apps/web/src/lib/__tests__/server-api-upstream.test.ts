import { describe, it, expect } from "vitest";
import {
  derivePdfUpstream,
  resolveUpstreamForHost,
} from "../server-api-upstream";
import { SITE_URLS } from "../site/surfaces";

describe("resolveUpstreamForHost", () => {
  it("local for localhost", () => {
    expect(resolveUpstreamForHost("localhost").target).toBe("local");
    expect(resolveUpstreamForHost("127.0.0.1").target).toBe("local");
  });
  it("dev for an unknown host", () => {
    expect(resolveUpstreamForHost("preview-xyz.vercel.app", {}).target).toBe("dev");
    expect(
      resolveUpstreamForHost("preview-xyz.vercel.app", { VERCEL_ENV: "preview" }).target,
    ).toBe("dev");
  });
  // Regressão: a URL *.vercel.app de um deploy de produção caía no backend de
  // DEV, que recusava o token de produção.
  it("prod for any host on a Vercel production deployment", () => {
    expect(
      resolveUpstreamForHost("proops-abc123.vercel.app", { VERCEL_ENV: "production" }).target,
    ).toBe("prod");
    expect(resolveUpstreamForHost(null, { VERCEL_ENV: "production" }).target).toBe("prod");
  });
  it("dev for null host", () => {
    expect(resolveUpstreamForHost(null, {}).target).toBe("dev");
  });
});

describe("derivePdfUpstream", () => {
  it("derives the pdf function URL from the prod api base", () => {
    expect(
      derivePdfUpstream(
        "https://southamerica-east1-erp-softcode-prod.cloudfunctions.net/api",
      ),
    ).toBe(
      "https://southamerica-east1-erp-softcode-prod.cloudfunctions.net/pdf",
    );
  });

  it("derives the pdf function URL from the local emulator base", () => {
    expect(
      derivePdfUpstream(
        "http://127.0.0.1:5001/erp-softcode/southamerica-east1/api",
      ),
    ).toBe("http://127.0.0.1:5001/erp-softcode/southamerica-east1/pdf");
  });

  it("only replaces the trailing /api segment", () => {
    expect(derivePdfUpstream("https://example.com/api/v1")).toBe(
      "https://example.com/api/v1",
    );
  });

  it("composes with resolveUpstreamForHost for production hosts", () => {
    const { baseUrl } = resolveUpstreamForHost("proops.com.br");
    expect(derivePdfUpstream(baseUrl)).toMatch(/\/pdf$/);
  });

  // Regression guard for the multi-host split: the ERP moves to a subdomain,
  // and an unlisted production host falls through to the DEV project instead
  // of failing, which would point real traffic at `erp-softcode` in silence.
  it.each([
    "proops.com.br",
    "www.proops.com.br",
    "erp.proops.com.br",
    "app.proops.com.br",
  ])("resolves %s to the production upstream", (host) => {
    expect(resolveUpstreamForHost(host)).toMatchObject({ target: "prod" });
  });

  // The list above is typed by hand, and a hand-typed list is how
  // `app.proops.com.br` was left out, caught in review before it shipped: the
  // app landing would have reported its browser errors to the DEV project. This one derives from the host policy,
  // so a surface added to `SITE_URLS` without a production upstream fails here.
  it.each(Object.entries(SITE_URLS))(
    "the %s surface (%s) is served by the production upstream",
    (_superficie, url) => {
      expect(resolveUpstreamForHost(new URL(url).hostname)).toMatchObject({
        target: "prod",
      });
    },
  );

  it("still sends unknown hosts to dev (previews, staging)", () => {
    expect(
      resolveUpstreamForHost("proops-web-git-feat.vercel.app"),
    ).toMatchObject({
      target: "dev",
    });
  });
});
