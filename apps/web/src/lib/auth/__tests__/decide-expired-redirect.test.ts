import { describe, expect, it } from "vitest";
import { decideExpiredRedirect } from "../decide-expired-redirect";

describe("decideExpiredRedirect", () => {
  it("routes an expired cookie to the silent re-mint interstitial", () => {
    expect(decideExpiredRedirect({ reason: "session_expired" })).toBe("refresh");
  });

  it("routes a revoked cookie straight to login (re-mint would fail)", () => {
    expect(decideExpiredRedirect({ reason: "session_revoked" })).toBe("login");
  });

  it("defaults to the interstitial for any other/absent reason (it is terminal-safe)", () => {
    expect(decideExpiredRedirect({ reason: undefined })).toBe("refresh");
    expect(decideExpiredRedirect({ reason: "whatever" })).toBe("refresh");
  });
});
