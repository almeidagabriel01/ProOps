import { describe, test, expect } from "vitest";
import { computeTrialInfo } from "@/lib/trial-info";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 6, 8, 12, 0, 0); // fixed "now" for deterministic tests

describe("computeTrialInfo", () => {
  test("not trialing → inactive regardless of trialEndsAt", () => {
    const info = computeTrialInfo("active", new Date(NOW + 3 * DAY).toISOString(), NOW);
    expect(info).toEqual({ isTrialing: false, daysRemaining: 0, endsAt: null });
  });

  test("trialing without trialEndsAt → inactive", () => {
    expect(computeTrialInfo("trialing", null, NOW)).toEqual({
      isTrialing: false,
      daysRemaining: 0,
      endsAt: null,
    });
  });

  test("trialing with 7 full days left → 7", () => {
    const endsAt = new Date(NOW + 7 * DAY).toISOString();
    const info = computeTrialInfo("trialing", endsAt, NOW);
    expect(info).toEqual({ isTrialing: true, daysRemaining: 7, endsAt });
  });

  test("ceils partial days (6h left still reads as 1 day)", () => {
    const endsAt = new Date(NOW + 6 * 60 * 60 * 1000).toISOString();
    expect(computeTrialInfo("trialing", endsAt, NOW).daysRemaining).toBe(1);
  });

  test("just over 3 days → 4 (banner still non-urgent)", () => {
    const endsAt = new Date(NOW + 3 * DAY + 60 * 1000).toISOString();
    expect(computeTrialInfo("trialing", endsAt, NOW).daysRemaining).toBe(4);
  });

  test("exactly 3 days left → 3 (urgent threshold)", () => {
    const endsAt = new Date(NOW + 3 * DAY).toISOString();
    expect(computeTrialInfo("trialing", endsAt, NOW).daysRemaining).toBe(3);
  });

  test("expired trial → daysRemaining floored at 0", () => {
    const endsAt = new Date(NOW - 2 * DAY).toISOString();
    const info = computeTrialInfo("trialing", endsAt, NOW);
    expect(info.isTrialing).toBe(true);
    expect(info.daysRemaining).toBe(0);
  });
});
