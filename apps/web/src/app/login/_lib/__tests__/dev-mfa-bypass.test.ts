import { describe, it, expect } from "vitest";
import { isDevMfaBypassClientEnabled } from "../dev-mfa-bypass";

describe("isDevMfaBypassClientEnabled", () => {
  it("enables on localhost against the erp-softcode dev project", () => {
    expect(isDevMfaBypassClientEnabled("localhost", "erp-softcode")).toBe(true);
    expect(isDevMfaBypassClientEnabled("127.0.0.1", "erp-softcode")).toBe(true);
  });

  it("disables when the project is prod", () => {
    expect(
      isDevMfaBypassClientEnabled("localhost", "erp-softcode-prod"),
    ).toBe(false);
  });

  it("disables off localhost even for the dev project", () => {
    expect(
      isDevMfaBypassClientEnabled("app.proops.com.br", "erp-softcode"),
    ).toBe(false);
    expect(
      isDevMfaBypassClientEnabled("erp-softcode.web.app", "erp-softcode"),
    ).toBe(false);
  });

  it("disables when inputs are missing", () => {
    expect(isDevMfaBypassClientEnabled(undefined, "erp-softcode")).toBe(false);
    expect(isDevMfaBypassClientEnabled("localhost", undefined)).toBe(false);
    expect(isDevMfaBypassClientEnabled(undefined, undefined)).toBe(false);
  });
});
