import type { TenantPlanTier } from "../lib/tenant-plan-policy";

export interface PlanTierReconciliation {
  /** Tier the customer is actually billed for (derived from the Stripe price). */
  priceTier: TenantPlanTier | null;
  /** Tier claimed by the (mutable) Stripe `metadata.planTier`. */
  metadataTier: TenantPlanTier | null;
  /** Tier to apply: the price is authoritative whenever it resolves. */
  resolvedTier: TenantPlanTier | null;
  /** True when a resolvable price disagrees with a present metadata claim. */
  mismatch: boolean;
}

/**
 * Reconciles the plan tier for a Stripe billing event.
 *
 * The Stripe price the customer is actually charged for is the source of truth
 * for their plan tier. `metadata.planTier` is mutable after the subscription is
 * created (Stripe dashboard / API), and the `customer.subscription.updated`
 * webhook reads the live metadata value — so it can drift away from the price.
 * Trusting metadata over the price would let the applied tier diverge from what
 * was billed.
 *
 * This makes the price tier authoritative: metadata is only validated against
 * it. On a mismatch the price wins and `mismatch` is flagged so the caller can
 * emit a security event. Metadata is used solely as a fallback when the price
 * maps to no known tier (e.g. a price not yet added to config), so a legitimate
 * plan is never silently dropped.
 */
export function reconcilePlanTier(input: {
  priceTier: TenantPlanTier | null;
  metadataTier: TenantPlanTier | null;
}): PlanTierReconciliation {
  const { priceTier, metadataTier } = input;
  const mismatch =
    priceTier != null && metadataTier != null && priceTier !== metadataTier;
  const resolvedTier = priceTier ?? metadataTier;
  return { priceTier, metadataTier, resolvedTier, mismatch };
}
