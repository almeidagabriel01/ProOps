import { describe, it, expect } from "vitest";
import { decideSessionVerification } from "../session-verification";

describe("decideSessionVerification", () => {
  it("verifies the WhatsApp OTP when an otpCode is present", () => {
    expect(
      decideSessionVerification({ otpCode: "123456", recoveryCode: "" }),
    ).toBe("otp");
  });

  it("verifies the recovery code when only a recoveryCode is present", () => {
    expect(
      decideSessionVerification({ otpCode: "", recoveryCode: "ABCD-1234" }),
    ).toBe("recovery-code");
  });

  it("runs the normal challenge gate when no verification input is present", () => {
    expect(decideSessionVerification({ otpCode: "", recoveryCode: "" })).toBe(
      "challenge",
    );
  });

  it("prefers the OTP over a recovery code when (defensively) both are present", () => {
    expect(
      decideSessionVerification({
        otpCode: "123456",
        recoveryCode: "ABCD-1234",
      }),
    ).toBe("otp");
  });
});
