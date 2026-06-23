import { isLegacyNoiseIssue } from "../resolve-legacy-observability-noise";

describe("isLegacyNoiseIssue", () => {
  it("matches the broken synthetic '[object Object]' captures", () => {
    expect(isLegacyNoiseIssue({ title: "[object Object]", severity: "warning", status: "unresolved" })).toBe(true);
  });

  it("matches web-reported ApiError validation noise", () => {
    expect(
      isLegacyNoiseIssue({ errorType: "ApiError", severity: "warning", status: "unresolved", source: "web" }),
    ).toBe(true);
  });

  it("never touches critical issues (the cron FAILED_PRECONDITION must stay)", () => {
    expect(
      isLegacyNoiseIssue({ errorType: "Error", severity: "critical", status: "unresolved", title: "[object Object]" }),
    ).toBe(false);
    // A critical ApiError (web 5xx) is also protected — not auto-resolved.
    expect(isLegacyNoiseIssue({ errorType: "ApiError", severity: "critical", status: "unresolved" })).toBe(false);
  });

  it("is idempotent — skips already-resolved issues", () => {
    expect(isLegacyNoiseIssue({ title: "[object Object]", severity: "warning", status: "resolved" })).toBe(false);
  });

  it("ignores unrelated genuine issues", () => {
    expect(
      isLegacyNoiseIssue({ errorType: "TypeError", severity: "error", status: "unresolved", title: "Cannot read x" }),
    ).toBe(false);
  });
});
