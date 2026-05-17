import { describe, it, expect } from "vitest";
import {
  isSubscriptionBlocked,
  isGracePeriodActive,
  HARD_BLOCKED_STATUSES,
  PAST_DUE_GRACE_DAYS,
} from "../subscription-blocked-statuses";

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

describe("HARD_BLOCKED_STATUSES", () => {
  it("contains the expected statuses", () => {
    expect(HARD_BLOCKED_STATUSES.has("canceled")).toBe(true);
    expect(HARD_BLOCKED_STATUSES.has("cancelled")).toBe(true);
    expect(HARD_BLOCKED_STATUSES.has("unpaid")).toBe(true);
    expect(HARD_BLOCKED_STATUSES.has("inactive")).toBe(true);
    expect(HARD_BLOCKED_STATUSES.has("payment_failed")).toBe(true);
    expect(HARD_BLOCKED_STATUSES.has("active")).toBe(false);
    expect(HARD_BLOCKED_STATUSES.has("trialing")).toBe(false);
  });
});

describe("isGracePeriodActive", () => {
  it("returns false for null/undefined pastDueSince (fail-closed)", () => {
    expect(isGracePeriodActive(null)).toBe(false);
    expect(isGracePeriodActive(undefined)).toBe(false);
    expect(isGracePeriodActive("")).toBe(false);
  });

  it("returns false for invalid date string", () => {
    expect(isGracePeriodActive("not-a-date")).toBe(false);
  });

  it("returns true when within grace period", () => {
    const recentDate = daysAgoIso(PAST_DUE_GRACE_DAYS - 1);
    expect(isGracePeriodActive(recentDate)).toBe(true);
  });

  it("returns false when grace period has expired", () => {
    const oldDate = daysAgoIso(PAST_DUE_GRACE_DAYS + 1);
    expect(isGracePeriodActive(oldDate)).toBe(false);
  });
});

describe("isSubscriptionBlocked", () => {
  it("returns false for 'active'", () => {
    expect(isSubscriptionBlocked("active")).toBe(false);
  });

  it("returns false for 'trialing'", () => {
    expect(isSubscriptionBlocked("trialing")).toBe(false);
  });

  it("returns false for null/undefined/empty", () => {
    expect(isSubscriptionBlocked(null)).toBe(false);
    expect(isSubscriptionBlocked(undefined)).toBe(false);
    expect(isSubscriptionBlocked("")).toBe(false);
  });

  it("returns true for 'canceled'", () => {
    expect(isSubscriptionBlocked("canceled")).toBe(true);
  });

  it("returns true for 'cancelled'", () => {
    expect(isSubscriptionBlocked("cancelled")).toBe(true);
  });

  it("returns true for 'unpaid'", () => {
    expect(isSubscriptionBlocked("unpaid")).toBe(true);
  });

  it("returns true for 'inactive'", () => {
    expect(isSubscriptionBlocked("inactive")).toBe(true);
  });

  it("returns true for 'payment_failed'", () => {
    expect(isSubscriptionBlocked("payment_failed")).toBe(true);
  });

  it("returns false for unknown status (fail-open)", () => {
    expect(isSubscriptionBlocked("some_unknown_status")).toBe(false);
  });

  it("past_due without pastDueSince → blocked (fail-closed)", () => {
    expect(isSubscriptionBlocked("past_due")).toBe(true);
    expect(isSubscriptionBlocked("past_due", null)).toBe(true);
  });

  it("past_due within grace period → not blocked", () => {
    const recent = daysAgoIso(PAST_DUE_GRACE_DAYS - 1);
    expect(isSubscriptionBlocked("past_due", recent)).toBe(false);
  });

  it("past_due outside grace period → blocked", () => {
    const old = daysAgoIso(PAST_DUE_GRACE_DAYS + 1);
    expect(isSubscriptionBlocked("past_due", old)).toBe(true);
  });
});
