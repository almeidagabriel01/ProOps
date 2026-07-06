import { describe, it, expect } from "vitest";
import {
  derivePdfUpstream,
  resolveUpstreamForHost,
} from "../server-api-upstream";

describe("resolveUpstreamForHost", () => {
  it("local for localhost", () => {
    expect(resolveUpstreamForHost("localhost").target).toBe("local");
    expect(resolveUpstreamForHost("127.0.0.1").target).toBe("local");
  });
  it("dev for an unknown host", () => {
    expect(resolveUpstreamForHost("preview-xyz.vercel.app").target).toBe("dev");
  });
  it("dev for null host", () => {
    expect(resolveUpstreamForHost(null).target).toBe("dev");
  });
});

describe("derivePdfUpstream", () => {
  it("derives the pdf function URL from the prod api base", () => {
    expect(
      derivePdfUpstream(
        "https://southamerica-east1-erp-softcode-prod.cloudfunctions.net/api",
      ),
    ).toBe("https://southamerica-east1-erp-softcode-prod.cloudfunctions.net/pdf");
  });

  it("derives the pdf function URL from the local emulator base", () => {
    expect(
      derivePdfUpstream("http://127.0.0.1:5001/erp-softcode/southamerica-east1/api"),
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
});
