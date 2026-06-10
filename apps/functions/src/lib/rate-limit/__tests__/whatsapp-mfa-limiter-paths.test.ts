import {
  WHATSAPP_MFA_OTP_LIMITED_PREFIXES,
  requiresWhatsappMfaOtpLimiter,
} from "../whatsapp-mfa-limiter-paths";

describe("requiresWhatsappMfaOtpLimiter", () => {
  it("requires the tight OTP limiter on every cost / brute-force surface", () => {
    expect(requiresWhatsappMfaOtpLimiter("/enroll/start")).toBe(true);
    expect(requiresWhatsappMfaOtpLimiter("/enroll/verify")).toBe(true);
    expect(requiresWhatsappMfaOtpLimiter("/challenge")).toBe(true);
    expect(requiresWhatsappMfaOtpLimiter("/verify")).toBe(true);
  });

  it("does NOT tight-limit /disable (turning off 2FA must not share the OTP budget)", () => {
    // Regression guard: /disable under the 5/min OTP limiter locked users out of
    // disabling their own WhatsApp 2FA (429).
    expect(requiresWhatsappMfaOtpLimiter("/disable")).toBe(false);
  });

  it("excludes /disable from the limited prefixes list that drives the mounts", () => {
    expect(WHATSAPP_MFA_OTP_LIMITED_PREFIXES).not.toContain("/disable");
    expect([...WHATSAPP_MFA_OTP_LIMITED_PREFIXES]).toEqual([
      "/enroll",
      "/challenge",
      "/verify",
    ]);
  });

  it("does not match unrelated or partial paths", () => {
    expect(requiresWhatsappMfaOtpLimiter("/")).toBe(false);
    expect(requiresWhatsappMfaOtpLimiter("/verifying")).toBe(false);
    expect(requiresWhatsappMfaOtpLimiter("/enrollment")).toBe(false);
  });
});
