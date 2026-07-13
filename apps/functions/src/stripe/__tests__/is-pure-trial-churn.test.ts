/**
 * Unit tests for isPureTrialChurn — the condition that decides whether a
 * canceled/unpaid subscription should fall back to the read-only demo mode
 * (role "free") vs. the /subscription-blocked page. Gates the demote in BOTH
 * the subscription.deleted AND subscription.updated→canceled webhook paths.
 */
jest.mock("../../init", () => ({ db: {}, auth: {}, adminApp: {} }));
jest.mock("../stripeConfig", () => ({ getStripe: jest.fn() }));

import { isPureTrialChurn } from "../stripeHelpers";

describe("isPureTrialChurn", () => {
  it("true when a trial was used and no invoice was ever paid", () => {
    expect(
      isPureTrialChurn({ trialUsedAt: "2026-07-09T00:00:00.000Z" }),
    ).toBe(true);
  });

  it("false when the trial converted (an invoice was paid)", () => {
    expect(
      isPureTrialChurn({
        trialUsedAt: "2026-07-09T00:00:00.000Z",
        hasPaidInvoice: true,
      }),
    ).toBe(false);
  });

  it("false when no trial was ever used (a genuinely paying account)", () => {
    expect(isPureTrialChurn({ hasPaidInvoice: true })).toBe(false);
    expect(isPureTrialChurn({})).toBe(false);
  });

  it("false for missing/undefined tenant data", () => {
    expect(isPureTrialChurn(undefined)).toBe(false);
    expect(isPureTrialChurn(null)).toBe(false);
  });

  it("treats hasPaidInvoice=false the same as absent (still pure churn)", () => {
    expect(
      isPureTrialChurn({
        trialUsedAt: "2026-07-09T00:00:00.000Z",
        hasPaidInvoice: false,
      }),
    ).toBe(true);
  });
});
