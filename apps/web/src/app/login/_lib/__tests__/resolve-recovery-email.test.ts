import { describe, expect, it } from "vitest";
import { resolveRecoveryEmail } from "../resolve-recovery-email";

describe("resolveRecoveryEmail", () => {
  it("uses the signed-in user's email when the form email is empty (Google sign-in, the bug)", () => {
    expect(resolveRecoveryEmail("user@example.com", "")).toBe(
      "user@example.com",
    );
  });

  it("prefers the signed-in user's email over the form email", () => {
    expect(resolveRecoveryEmail("real@example.com", "typed@example.com")).toBe(
      "real@example.com",
    );
  });

  it("falls back to the typed email when there is no signed-in email", () => {
    expect(resolveRecoveryEmail(null, "typed@example.com")).toBe(
      "typed@example.com",
    );
    expect(resolveRecoveryEmail(undefined, "typed@example.com")).toBe(
      "typed@example.com",
    );
  });

  it("trims whitespace and returns empty when neither is present", () => {
    expect(resolveRecoveryEmail(null, "  spaced@example.com  ")).toBe(
      "spaced@example.com",
    );
    expect(resolveRecoveryEmail(null, "")).toBe("");
    expect(resolveRecoveryEmail("", "")).toBe("");
  });
});
