import { describe, expect, it } from "vitest";
import {
  canEnrollMfa,
  canUseWhatsappMfa,
  isMfaRequiredError,
  isValidTotpCode,
  maskPhone,
  shouldAutoOpenRecoveryCodes,
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

describe("maskPhone", () => {
  it("keeps only the last 4 digits with a masked prefix", () => {
    expect(maskPhone("+5511999991234")).toBe("•••• 1234");
  });

  it("strips non-digits before masking", () => {
    expect(maskPhone("(11) 99999-1234")).toBe("•••• 1234");
  });

  it("returns the digits unchanged when 4 or fewer", () => {
    expect(maskPhone("1234")).toBe("1234");
    expect(maskPhone("12")).toBe("12");
  });

  it("handles empty and null-ish input", () => {
    expect(maskPhone("")).toBe("");
    expect(maskPhone(undefined as unknown as string)).toBe("");
  });
});

describe("canUseWhatsappMfa", () => {
  it("hides WhatsApp for super admins (TOTP-only)", () => {
    expect(canUseWhatsappMfa("superadmin")).toBe(false);
    expect(canUseWhatsappMfa("SUPERADMIN")).toBe(false);
    expect(canUseWhatsappMfa(" SuperAdmin ")).toBe(false);
  });

  it("offers WhatsApp to every other role", () => {
    expect(canUseWhatsappMfa("admin")).toBe(true);
    expect(canUseWhatsappMfa("member")).toBe(true);
    expect(canUseWhatsappMfa("free")).toBe(true);
    expect(canUseWhatsappMfa("user")).toBe(true);
  });

  it("offers WhatsApp when the role is unknown/undefined", () => {
    expect(canUseWhatsappMfa(undefined)).toBe(true);
    expect(canUseWhatsappMfa(null)).toBe(true);
    expect(canUseWhatsappMfa("")).toBe(true);
  });
});

describe("shouldAutoOpenRecoveryCodes", () => {
  it("auto-opens after the first enroll when no codes exist yet", () => {
    expect(
      shouldAutoOpenRecoveryCodes({ hasAnyFactor: true, recoveryTotal: 0 }),
    ).toBe(true);
  });

  it("does not auto-open when the user already has codes", () => {
    expect(
      shouldAutoOpenRecoveryCodes({ hasAnyFactor: true, recoveryTotal: 10 }),
    ).toBe(false);
    expect(
      shouldAutoOpenRecoveryCodes({ hasAnyFactor: true, recoveryTotal: 1 }),
    ).toBe(false);
  });

  it("does not auto-open when there is no active factor", () => {
    expect(
      shouldAutoOpenRecoveryCodes({ hasAnyFactor: false, recoveryTotal: 0 }),
    ).toBe(false);
    expect(
      shouldAutoOpenRecoveryCodes({ hasAnyFactor: false, recoveryTotal: 10 }),
    ).toBe(false);
  });
});
