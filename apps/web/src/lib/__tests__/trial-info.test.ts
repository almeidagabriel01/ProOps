import { describe, test, expect } from "vitest";
import { computeTrialInfo } from "@/lib/trial-info";

// Fixed "now" built from LOCAL date parts so the calendar-day math is
// deterministic regardless of the test runner's timezone.
const NOW = new Date(2026, 6, 8, 12, 0, 0).getTime(); // 2026-07-08 12:00 local
const atLocal = (y: number, m: number, d: number, h = 12, min = 0, s = 0) =>
  new Date(y, m, d, h, min, s).toISOString();

describe("computeTrialInfo", () => {
  test("not trialing → inactive regardless of trialEndsAt", () => {
    const info = computeTrialInfo("active", atLocal(2026, 6, 11), NOW);
    expect(info).toEqual({ isTrialing: false, daysRemaining: 0, endsAt: null });
  });

  test("trialing without trialEndsAt → inactive", () => {
    expect(computeTrialInfo("trialing", null, NOW)).toEqual({
      isTrialing: false,
      daysRemaining: 0,
      endsAt: null,
    });
  });

  test("trialing with 7 days left → 7", () => {
    const endsAt = atLocal(2026, 6, 15); // 7 calendar days after Jul 8
    const info = computeTrialInfo("trialing", endsAt, NOW);
    expect(info).toEqual({ isTrialing: true, daysRemaining: 7, endsAt });
  });

  // Regression: a fresh 7-day trial whose end is a few seconds past the exact
  // 7*24h mark must still read 7 — not 8 (the old raw-ceil bug that made the
  // header banner show "8 dias" while the profile showed "7 dias").
  test("7-day trial a few seconds over the 7*24h mark still reads 7 (not 8)", () => {
    const endsAt = atLocal(2026, 6, 15, 12, 0, 30); // Jul 15 12:00:30
    expect(computeTrialInfo("trialing", endsAt, NOW).daysRemaining).toBe(7);
  });

  // Immune to time-of-day: end early on the 7th day vs. now late still counts
  // the full 7 calendar days, so banner and profile agree regardless of when
  // each recomputes.
  test("time-of-day does not shift the calendar-day count", () => {
    const now = new Date(2026, 6, 8, 23, 0, 0).getTime(); // late on Jul 8
    const endsAt = atLocal(2026, 6, 15, 1, 0, 0); // early on Jul 15
    expect(computeTrialInfo("trialing", endsAt, now).daysRemaining).toBe(7);
  });

  test("ending later today → 0 (banner reads 'ends today')", () => {
    const endsAt = atLocal(2026, 6, 8, 18, 0, 0); // same day, 6h later
    expect(computeTrialInfo("trialing", endsAt, NOW).daysRemaining).toBe(0);
  });

  test("ending tomorrow → 1", () => {
    const endsAt = atLocal(2026, 6, 9, 1, 0, 0); // next calendar day
    expect(computeTrialInfo("trialing", endsAt, NOW).daysRemaining).toBe(1);
  });

  test("exactly 3 calendar days left → 3 (urgent threshold)", () => {
    const endsAt = atLocal(2026, 6, 11);
    expect(computeTrialInfo("trialing", endsAt, NOW).daysRemaining).toBe(3);
  });

  test("expired trial → daysRemaining floored at 0", () => {
    const endsAt = atLocal(2026, 6, 6); // 2 days ago
    const info = computeTrialInfo("trialing", endsAt, NOW);
    expect(info.isTrialing).toBe(true);
    expect(info.daysRemaining).toBe(0);
  });
});
