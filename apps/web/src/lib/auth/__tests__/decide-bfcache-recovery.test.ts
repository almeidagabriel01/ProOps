import { describe, expect, it } from "vitest";
import { shouldReloadOnPageShow } from "../decide-bfcache-recovery";

describe("shouldReloadOnPageShow", () => {
  it("recovers on a bfcache restore (persisted) — production back/forward", () => {
    expect(
      shouldReloadOnPageShow({ persisted: true, navigationType: "navigate" }),
    ).toBe(true);
  });

  // The exact dev/bfcache-ineligible case: a history nav that fully reloads the
  // document reports persisted=false but navigationType "back_forward". A
  // bfcache-only check missed this and left the white screen.
  it("recovers on a back_forward navigation even when not persisted", () => {
    expect(
      shouldReloadOnPageShow({ persisted: false, navigationType: "back_forward" }),
    ).toBe(true);
  });

  it("does NOT reload on a normal fresh load (navigate)", () => {
    expect(
      shouldReloadOnPageShow({ persisted: false, navigationType: "navigate" }),
    ).toBe(false);
  });

  // After our own reload the type is "reload" — must NOT reload again (no loop).
  it("does NOT reload after a reload (loop guard)", () => {
    expect(
      shouldReloadOnPageShow({ persisted: false, navigationType: "reload" }),
    ).toBe(false);
  });
});
