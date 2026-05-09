import { getPriceConfig } from "../stripe/stripeConfig";
import { resolvePriceToTier } from "../lib/tenant-plan-policy";

export interface PriceDriftResult {
  hasDrift: boolean;
  currentPriceId: string | null;
  expectedPriceId: string | null;
  tier: string | null;
  billingInterval: "monthly" | "yearly" | null;
}

/**
 * Detects whether a tenant's stripePriceId differs from the current
 * env-configured priceId for their plan tier and billing interval.
 *
 * Returns hasDrift=false when either priceId is missing, when the tenant
 * is on a manual subscription (no Stripe), or when the priceId cannot be
 * resolved to a known tier.
 */
export function detectPriceDrift(tenantData: {
  stripePriceId?: string | null;
  priceId?: string | null;
  billingInterval?: string | null;
  isManualSubscription?: boolean;
  stripeSubscriptionId?: string | null;
}): PriceDriftResult {
  const noResult: PriceDriftResult = {
    hasDrift: false,
    currentPriceId: null,
    expectedPriceId: null,
    tier: null,
    billingInterval: null,
  };

  // Manual subscriptions have no Stripe subscription to migrate
  if (tenantData.isManualSubscription || !tenantData.stripeSubscriptionId) {
    return noResult;
  }

  const currentPriceId =
    (tenantData.stripePriceId ?? tenantData.priceId ?? "").trim() || null;

  if (!currentPriceId) {
    return noResult;
  }

  const billingInterval: "monthly" | "yearly" =
    tenantData.billingInterval === "yearly" ? "yearly" : "monthly";

  const tier = resolvePriceToTier(currentPriceId);
  if (!tier) {
    return { hasDrift: false, currentPriceId, expectedPriceId: null, tier: null, billingInterval };
  }

  const config = getPriceConfig();
  const planConfig = config.plans[tier];
  if (!planConfig) {
    return { hasDrift: false, currentPriceId, expectedPriceId: null, tier, billingInterval };
  }

  const expectedPriceId =
    (billingInterval === "yearly" ? planConfig.yearly : planConfig.monthly) || null;

  const hasDrift = Boolean(expectedPriceId && currentPriceId !== expectedPriceId);

  return { hasDrift, currentPriceId, expectedPriceId, tier, billingInterval };
}
