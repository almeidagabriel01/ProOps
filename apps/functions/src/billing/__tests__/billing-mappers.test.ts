/**
 * Unit tests for billing-mappers pure helpers.
 *
 * Focus: extractTrialEndsAt() — derives the ISO trial-end timestamp that drives
 * the 7-day trial countdown banner and the tenant.trialEndsAt field.
 */

// Mock Firebase init and Stripe helpers so importing the mapper module does not
// require a live Firebase app / Stripe config.
jest.mock("../../init", () => ({ db: {}, auth: {}, adminApp: {} }));
jest.mock("../../stripe/stripeHelpers", () => ({
  WHATSAPP_OVERAGE_PRICE_ID: "price_whatsapp_overage",
}));

import { extractTrialEndsAt } from "../billing-mappers";

describe("extractTrialEndsAt", () => {
  test("returns ISO string when trial_end is set", () => {
    // 2026-07-15T00:00:00.000Z → unix seconds
    const trialEndUnix = Math.floor(Date.UTC(2026, 6, 15) / 1000);
    expect(extractTrialEndsAt({ trial_end: trialEndUnix })).toBe(
      "2026-07-15T00:00:00.000Z",
    );
  });

  test("returns null when trial_end is missing", () => {
    expect(extractTrialEndsAt({})).toBeNull();
  });

  test("returns null when trial_end is null", () => {
    expect(extractTrialEndsAt({ trial_end: null })).toBeNull();
  });

  test("returns null when trial_end is 0 (falsy — no trial)", () => {
    expect(extractTrialEndsAt({ trial_end: 0 })).toBeNull();
  });
});
