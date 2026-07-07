/**
 * Unit tests for shouldFetchFreshClaims — decides when the auth middleware
 * must call auth.getUser() for fresh custom claims vs. trusting the claims
 * already embedded in the verified ID token (hot-path optimization).
 */

import { shouldFetchFreshClaims } from "../auth-context";

describe("shouldFetchFreshClaims", () => {
  const base = { mode: "auto" };

  it("skips getUser for stable paid role with tenant", () => {
    expect(
      shouldFetchFreshClaims({ ...base, tokenRole: "MASTER", tokenTenantId: "t1" }),
    ).toBe(false);
    expect(
      shouldFetchFreshClaims({ ...base, tokenRole: "MEMBER", tokenTenantId: "t1" }),
    ).toBe(false);
    expect(
      shouldFetchFreshClaims({ ...base, tokenRole: "ADMIN", tokenTenantId: "t1" }),
    ).toBe(false);
    expect(
      shouldFetchFreshClaims({ ...base, tokenRole: "WK", tokenTenantId: "t1" }),
    ).toBe(false);
  });

  it("fetches when role is missing", () => {
    expect(
      shouldFetchFreshClaims({ ...base, tokenRole: "", tokenTenantId: "t1" }),
    ).toBe(true);
  });

  it("fetches when tenant is missing for non-superadmin", () => {
    expect(
      shouldFetchFreshClaims({ ...base, tokenRole: "MASTER", tokenTenantId: "" }),
    ).toBe(true);
  });

  it("always fetches for FREE (upgrade must reflect instantly)", () => {
    expect(
      shouldFetchFreshClaims({ ...base, tokenRole: "FREE", tokenTenantId: "t1" }),
    ).toBe(true);
  });

  it("always fetches for SUPERADMIN (security-sensitive)", () => {
    expect(
      shouldFetchFreshClaims({ ...base, tokenRole: "SUPERADMIN", tokenTenantId: "" }),
    ).toBe(true);
  });

  it("normalizes role/tenant before deciding", () => {
    expect(
      shouldFetchFreshClaims({ ...base, tokenRole: " master ", tokenTenantId: " t1 " }),
    ).toBe(false);
    expect(
      shouldFetchFreshClaims({ ...base, tokenRole: "free", tokenTenantId: "t1" }),
    ).toBe(true);
  });

  it("mode=always restores legacy behavior (getUser on every request)", () => {
    expect(
      shouldFetchFreshClaims({ mode: "always", tokenRole: "MASTER", tokenTenantId: "t1" }),
    ).toBe(true);
  });
});
