import { describe, it, expect } from "vitest";
import { getCaptchaToken } from "../captcha";

describe("getCaptchaToken", () => {
  it("resolves to an empty string when Turnstile is not configured", async () => {
    // No NEXT_PUBLIC_TURNSTILE_SITE_KEY in the test env → captcha is skipped and
    // the backend skips verification too, so the signup form keeps working.
    await expect(getCaptchaToken()).resolves.toBe("");
  });
});
