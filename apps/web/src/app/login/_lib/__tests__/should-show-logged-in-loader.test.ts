import { describe, expect, it } from "vitest";
import {
  shouldShowLoggedInLoader,
  type LoggedInLoaderState,
} from "../should-show-logged-in-loader";

const base: LoggedInLoaderState = {
  isLoggingIn: false,
  isRegistering: false,
  requiresMfaCode: false,
  requiresWhatsappOtp: false,
  isSessionSynced: true,
};

describe("shouldShowLoggedInLoader", () => {
  it("shows the loader for a settled logged-in user with no pending screen", () => {
    expect(shouldShowLoggedInLoader(base)).toBe(true);
  });

  it("does NOT show the loader before the session is synced (the gate is still undetermined)", () => {
    // Regression: a Firebase `user` is set the instant sign-in completes, but
    // the server round-trip that decides "enter app" vs "WhatsApp gate" is still
    // in flight (whatsappMfaPending not yet known). Showing the full-screen
    // "entering app" loader here is misleading and, on the background/persisted
    // session path, it flashed before the WhatsApp OTP screen appeared.
    expect(
      shouldShowLoggedInLoader({ ...base, isSessionSynced: false }),
    ).toBe(false);
  });

  it("stays suppressed when both the gate is pending AND the session is unsynced", () => {
    expect(
      shouldShowLoggedInLoader({
        ...base,
        isSessionSynced: false,
        requiresWhatsappOtp: true,
      }),
    ).toBe(false);
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

  it("does NOT show the loader mid sign-in / registration", () => {
    expect(shouldShowLoggedInLoader({ ...base, isLoggingIn: true })).toBe(false);
    expect(shouldShowLoggedInLoader({ ...base, isRegistering: true })).toBe(
      false,
    );
  });
});
