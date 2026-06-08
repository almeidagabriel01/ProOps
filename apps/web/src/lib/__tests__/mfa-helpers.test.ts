import { describe, expect, it } from "vitest";
import { canEnrollMfa, isValidTotpCode } from "../mfa-helpers";

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
