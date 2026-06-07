/**
 * B1 — Stripe plan-tier escalation hardening.
 *
 * The Stripe price is the source of truth for the plan tier; the mutable
 * `metadata.planTier` is only a hint. These tests pin the corrected invariant:
 * when a resolvable price disagrees with the metadata claim, the price wins and
 * the mismatch is flagged. Before the fix the webhook applied
 * `metadataTier ?? priceTier` (metadata-first), which these assertions reject.
 */

import { reconcilePlanTier } from "../plan-tier-reconciliation";

describe("reconcilePlanTier", () => {
  it("uses the price tier as the authority when price and metadata agree", () => {
    const result = reconcilePlanTier({ priceTier: "pro", metadataTier: "pro" });
    expect(result.resolvedTier).toBe("pro");
    expect(result.mismatch).toBe(false);
  });

  it("ignores an inflated metadata claim and keeps the billed price tier (escalation guard)", () => {
    // Attack shape: subscription metadata edited to "enterprise" while the
    // customer is only billed for the "starter" price.
    const result = reconcilePlanTier({
      priceTier: "starter",
      metadataTier: "enterprise",
    });
    expect(result.resolvedTier).toBe("starter");
    expect(result.mismatch).toBe(true);
  });

  it("downgrade attempt via metadata is also ignored in favor of the price", () => {
    const result = reconcilePlanTier({
      priceTier: "enterprise",
      metadataTier: "free",
    });
    expect(result.resolvedTier).toBe("enterprise");
    expect(result.mismatch).toBe(true);
  });

  it("applies the price tier even when metadata is absent", () => {
    const result = reconcilePlanTier({ priceTier: "pro", metadataTier: null });
    expect(result.resolvedTier).toBe("pro");
    expect(result.mismatch).toBe(false);
  });

  it("falls back to metadata only when the price maps to no known tier", () => {
    const result = reconcilePlanTier({ priceTier: null, metadataTier: "pro" });
    expect(result.resolvedTier).toBe("pro");
    // No resolvable price to contradict the metadata → not a mismatch.
    expect(result.mismatch).toBe(false);
  });

  it("resolves to null when neither the price nor metadata yields a tier", () => {
    const result = reconcilePlanTier({ priceTier: null, metadataTier: null });
    expect(result.resolvedTier).toBeNull();
    expect(result.mismatch).toBe(false);
  });
});
