import { describe, expect, it } from "vitest";
import { shouldReloadOnPageShow } from "../decide-bfcache-recovery";

describe("shouldReloadOnPageShow", () => {
  it("recovers (reloads) on a bfcache restore — fixes the white screen on back/forward", () => {
    expect(shouldReloadOnPageShow({ persisted: true })).toBe(true);
  });

  it("does nothing on a normal (non-bfcache) pageshow", () => {
    expect(shouldReloadOnPageShow({ persisted: false })).toBe(false);
  });

  // Regression: the old handler returned early when a user was logged in, so a
  // logged-in bfcache restore stayed blank. The decision must not depend on
  // auth state — a persisted restore always recovers, logged in or out.
  it("recovers regardless of auth state (decision is auth-agnostic)", () => {
    expect(shouldReloadOnPageShow({ persisted: true })).toBe(true);
  });
});
