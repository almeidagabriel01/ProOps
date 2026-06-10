import { describe, it, expect } from "vitest";
import { extractEmailFromAuthError } from "../extract-email-from-auth-error";

describe("extractEmailFromAuthError", () => {
  it("reads customData.email", () => {
    expect(
      extractEmailFromAuthError({ customData: { email: "a@b.com" } }),
    ).toBe("a@b.com");
  });

  it("reads the federated sign-in response email (customData._serverResponse)", () => {
    // Firebase attaches the signInWithIdp (Google) response here on
    // `auth/multi-factor-auth-required` — the form email is empty for Google.
    expect(
      extractEmailFromAuthError({
        code: "auth/multi-factor-auth-required",
        customData: { _serverResponse: { email: "google@user.com" } },
      }),
    ).toBe("google@user.com");
  });

  it("reads customData._tokenResponse.email", () => {
    expect(
      extractEmailFromAuthError({
        customData: { _tokenResponse: { email: "tok@user.com" } },
      }),
    ).toBe("tok@user.com");
  });

  it("reads a top-level _tokenResponse.email", () => {
    expect(
      extractEmailFromAuthError({ _tokenResponse: { email: "top@user.com" } }),
    ).toBe("top@user.com");
  });

  it("reads a top-level email", () => {
    expect(extractEmailFromAuthError({ email: "plain@user.com" })).toBe(
      "plain@user.com",
    );
  });

  it("returns empty string when no email is present", () => {
    expect(
      extractEmailFromAuthError({ code: "auth/multi-factor-auth-required" }),
    ).toBe("");
    expect(extractEmailFromAuthError(null)).toBe("");
    expect(extractEmailFromAuthError(undefined)).toBe("");
  });

  it("prefers customData.email over deeper fields", () => {
    expect(
      extractEmailFromAuthError({
        customData: {
          email: "primary@user.com",
          _serverResponse: { email: "secondary@user.com" },
        },
      }),
    ).toBe("primary@user.com");
  });
});
