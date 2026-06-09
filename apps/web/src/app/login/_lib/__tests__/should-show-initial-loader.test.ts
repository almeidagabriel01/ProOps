import { describe, it, expect } from "vitest";
import {
  shouldShowInitialLoader,
  type InitialLoaderState,
} from "../should-show-initial-loader";

const base: InitialLoaderState = {
  isLoading: true,
  isLoggingIn: false,
  isRegistering: false,
  hasUser: false,
  requiresMfaCode: false,
  requiresWhatsappOtp: false,
};

describe("shouldShowInitialLoader", () => {
  it("shows the loader on first paint while auth is resolving and no user yet", () => {
    expect(shouldShowInitialLoader(base)).toBe(true);
  });

  it("does NOT show once a user is present", () => {
    expect(shouldShowInitialLoader({ ...base, hasUser: true })).toBe(false);
  });

  it("does NOT show during an explicit login/register", () => {
    expect(shouldShowInitialLoader({ ...base, isLoggingIn: true })).toBe(false);
    expect(shouldShowInitialLoader({ ...base, isRegistering: true })).toBe(false);
  });

  it("does NOT show while the native TOTP challenge is active", () => {
    // Regression: mid-TOTP-verification the Firebase user briefly appears before
    // requiresMfaCode clears; this loader must stay OFF so the TOTP screen does
    // not flash between two loaders.
    expect(
      shouldShowInitialLoader({ ...base, requiresMfaCode: true }),
    ).toBe(false);
    // Even with isLoading true and no user (the exact mid-verification state).
    expect(
      shouldShowInitialLoader({
        ...base,
        requiresMfaCode: true,
        isLoading: true,
        hasUser: false,
      }),
    ).toBe(false);
  });

  it("does NOT show while the WhatsApp OTP gate is active", () => {
    expect(
      shouldShowInitialLoader({ ...base, requiresWhatsappOtp: true }),
    ).toBe(false);
  });
});
