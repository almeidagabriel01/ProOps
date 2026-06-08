import { describe, expect, it } from "vitest";
import {
  canEnrollMfa,
  isMfaRequiredError,
  isValidTotpCode,
} from "../mfa-helpers";

describe("isValidTotpCode", () => {
  it("accepts exactly 6 digits", () => {
    expect(isValidTotpCode("123456")).toBe(true);
  });

  it("trims surrounding whitespace", () => {
    expect(isValidTotpCode("  654321  ")).toBe(true);
  });

  it("rejects fewer than 6 digits", () => {
    expect(isValidTotpCode("12345")).toBe(false);
  });

  it("rejects more than 6 digits", () => {
    expect(isValidTotpCode("1234567")).toBe(false);
  });

  it("rejects non-numeric characters", () => {
    expect(isValidTotpCode("12a456")).toBe(false);
    expect(isValidTotpCode("abcdef")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidTotpCode("")).toBe(false);
  });
});

describe("isMfaRequiredError", () => {
  it("detects the multi-factor-auth-required code (password and Google paths)", () => {
    expect(
      isMfaRequiredError({ code: "auth/multi-factor-auth-required" }),
    ).toBe(true);
  });

  it("detects it on a real FirebaseError-like instance", () => {
    const err = Object.assign(new Error("Firebase: Error"), {
      code: "auth/multi-factor-auth-required",
    });
    expect(isMfaRequiredError(err)).toBe(true);
  });

  it("returns false for other auth errors", () => {
    expect(isMfaRequiredError({ code: "auth/popup-closed-by-user" })).toBe(
      false,
    );
    expect(isMfaRequiredError({ code: "auth/wrong-password" })).toBe(false);
  });

  it("returns false for null, undefined, and non-objects", () => {
    expect(isMfaRequiredError(null)).toBe(false);
    expect(isMfaRequiredError(undefined)).toBe(false);
    expect(isMfaRequiredError("auth/multi-factor-auth-required")).toBe(false);
  });
});

describe("canEnrollMfa", () => {
  it("allows enrollment when email is verified", () => {
    expect(canEnrollMfa({ emailVerified: true })).toEqual({ ok: true });
  });

  it("blocks enrollment when email is not verified", () => {
    expect(canEnrollMfa({ emailVerified: false })).toEqual({
      ok: false,
      reason: "email-unverified",
    });
  });

  it("blocks enrollment when there is no user", () => {
    expect(canEnrollMfa(null)).toEqual({ ok: false, reason: "no-user" });
  });
});
