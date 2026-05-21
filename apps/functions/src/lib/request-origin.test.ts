/**
 * Verifies that the trusted origin resolver:
 *  - uses the request Origin / x-forwarded-host only when the CORS allow-list admits it
 *  - falls back to resolveFrontendAppOrigin() when neither header is trustworthy
 *  - never trusts a forged `x-forwarded-host` in production
 */

jest.mock("./frontend-app-url", () => ({
  resolveFrontendAppOrigin: jest.fn(() => "https://www.proops.com.br"),
}));

import type { Request } from "express";
import { resolveTrustedRequestOrigin } from "./request-origin";

function makeReq(headers: Record<string, string>): Request {
  return { headers } as unknown as Request;
}

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV };
  delete process.env.CORS_ALLOWED_ORIGINS;
  delete process.env.APP_URL;
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.VERCEL_URL;
  delete process.env.VERCEL_BRANCH_URL;
  delete process.env.NEXT_PUBLIC_VERCEL_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  delete process.env.CORS_ALLOW_DYNAMIC_PREVIEW_ORIGINS;
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("resolveTrustedRequestOrigin (production)", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "production";
  });

  it("trusts request Origin when it is in the CORS allow-list", () => {
    process.env.CORS_ALLOWED_ORIGINS = "https://www.proops.com.br";
    const req = makeReq({ origin: "https://www.proops.com.br" });
    expect(resolveTrustedRequestOrigin(req)).toBe("https://www.proops.com.br");
  });

  it("trusts x-forwarded-host when proto/host are in the allow-list", () => {
    process.env.CORS_ALLOWED_ORIGINS = "https://www.proops.com.br";
    const req = makeReq({
      "x-forwarded-host": "www.proops.com.br",
      "x-forwarded-proto": "https",
    });
    expect(resolveTrustedRequestOrigin(req)).toBe("https://www.proops.com.br");
  });

  it("trusts the www variant added automatically by addOriginWithVariants", () => {
    // CORS layer auto-adds www/bare variants for non-localhost hosts.
    process.env.CORS_ALLOWED_ORIGINS = "https://proops.com.br";
    const req = makeReq({ origin: "https://www.proops.com.br" });
    expect(resolveTrustedRequestOrigin(req)).toBe("https://www.proops.com.br");
  });

  it("rejects a forged x-forwarded-host that is not in the allow-list", () => {
    process.env.CORS_ALLOWED_ORIGINS = "https://www.proops.com.br";
    const req = makeReq({
      "x-forwarded-host": "evil.com",
      "x-forwarded-proto": "https",
    });
    expect(resolveTrustedRequestOrigin(req)).toBe("https://www.proops.com.br");
  });

  it("does not auto-trust *.vercel.app in production (dynamic preview disabled by default)", () => {
    process.env.CORS_ALLOWED_ORIGINS = "https://www.proops.com.br";
    const req = makeReq({ origin: "https://evil.vercel.app" });
    expect(resolveTrustedRequestOrigin(req)).toBe("https://www.proops.com.br");
  });

  it("falls back to resolveFrontendAppOrigin() when no headers are present", () => {
    process.env.CORS_ALLOWED_ORIGINS = "https://www.proops.com.br";
    const req = makeReq({});
    expect(resolveTrustedRequestOrigin(req)).toBe("https://www.proops.com.br");
  });
});

describe("resolveTrustedRequestOrigin (development)", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "development";
  });

  it("trusts localhost origins automatically (allow-list adds them in dev)", () => {
    const req = makeReq({ origin: "http://localhost:3000" });
    expect(resolveTrustedRequestOrigin(req)).toBe("http://localhost:3000");
  });

  it("trusts *.vercel.app preview origins automatically", () => {
    const req = makeReq({
      origin: "https://template-erp-git-develop-gestao-2562s-projects.vercel.app",
    });
    expect(resolveTrustedRequestOrigin(req)).toBe(
      "https://template-erp-git-develop-gestao-2562s-projects.vercel.app",
    );
  });

  it("falls back to resolveFrontendAppOrigin() when no headers are present", () => {
    const req = makeReq({});
    expect(resolveTrustedRequestOrigin(req)).toBe("https://www.proops.com.br");
  });
});
