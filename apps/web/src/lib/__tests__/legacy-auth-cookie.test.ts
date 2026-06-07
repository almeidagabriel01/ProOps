import { describe, it, expect } from "vitest";
import { shouldAcceptLegacyAuthCookie } from "../legacy-auth-cookie";

describe("shouldAcceptLegacyAuthCookie", () => {
  it("is HARD-disabled in production, even when the env hint says true", () => {
    expect(shouldAcceptLegacyAuthCookie({ NODE_ENV: "production" })).toBe(false);
    // The hardening: the env var can NOT re-enable the legacy cookie in prod.
    expect(
      shouldAcceptLegacyAuthCookie({
        NODE_ENV: "production",
        AUTH_ACCEPT_LEGACY_COOKIE_HINT: "true",
      }),
    ).toBe(false);
    expect(
      shouldAcceptLegacyAuthCookie({
        NODE_ENV: "production",
        AUTH_ACCEPT_LEGACY_COOKIE_HINT: "false",
      }),
    ).toBe(false);
  });

  it("defaults on in non-production", () => {
    expect(shouldAcceptLegacyAuthCookie({ NODE_ENV: "development" })).toBe(true);
    expect(shouldAcceptLegacyAuthCookie({})).toBe(true);
  });

  it("non-production can still opt out via AUTH_ACCEPT_LEGACY_COOKIE_HINT=false", () => {
    expect(
      shouldAcceptLegacyAuthCookie({
        NODE_ENV: "development",
        AUTH_ACCEPT_LEGACY_COOKIE_HINT: "false",
      }),
    ).toBe(false);
    expect(
      shouldAcceptLegacyAuthCookie({
        NODE_ENV: "development",
        AUTH_ACCEPT_LEGACY_COOKIE_HINT: "true",
      }),
    ).toBe(true);
  });
});
