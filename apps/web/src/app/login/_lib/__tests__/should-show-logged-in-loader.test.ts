import { describe, expect, it } from "vitest";
import {
  shouldShowLoggedInLoader,
  type LoggedInLoaderState,
} from "../should-show-logged-in-loader";

const base: LoggedInLoaderState = {
  isLoggingIn: false,
  isRegistering: false,
  sessionRecoveryFailed: false,
  requiresMfaCode: false,
  requiresWhatsappOtp: false,
};

describe("shouldShowLoggedInLoader", () => {
  it("shows the loader for a settled logged-in user with no pending screen", () => {
    expect(shouldShowLoggedInLoader(base)).toBe(true);
  });

  it("does NOT show the loader while the WhatsApp OTP screen is pending (the bug)", () => {
    // Regression: Google sign-in (and password) set the Firebase user before the
    // custom WhatsApp gate is surfaced. The loader must yield to the OTP screen.
    expect(
      shouldShowLoggedInLoader({ ...base, requiresWhatsappOtp: true }),
    ).toBe(false);
  });

  it("does NOT show the loader while the native TOTP code screen is pending", () => {
    expect(shouldShowLoggedInLoader({ ...base, requiresMfaCode: true })).toBe(
      false,
    );
  });

  it("does NOT show the loader mid sign-in / registration / recovery failure", () => {
    expect(shouldShowLoggedInLoader({ ...base, isLoggingIn: true })).toBe(false);
    expect(shouldShowLoggedInLoader({ ...base, isRegistering: true })).toBe(
      false,
    );
    expect(
      shouldShowLoggedInLoader({ ...base, sessionRecoveryFailed: true }),
    ).toBe(false);
  });
});
