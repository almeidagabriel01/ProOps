import { WHATSAPP_OVERAGE_PRICE_ID } from "../stripe/stripeHelpers";
import { resolvePriceToTier } from "../lib/tenant-plan-policy";
import type { BillingStatus } from "./billing-types";
import { classifySubscription } from "./subscription-classifier";

export function mapStripeStatusToBilling(status: string): BillingStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "unpaid":
      return "unpaid";
    default:
      return "inactive";
  }
}

export function resolvePlanFromPrice(priceId: string | null): string | null {
  if (!priceId) return null;
  return resolvePriceToTier(priceId) ?? null;
}

export function extractBillingInterval(subscription: {
  items: { data: Array<{ price: { id: string; recurring?: { interval?: string } | null } }> };
}): "monthly" | "yearly" {
  const primary = subscription.items.data.find(
    (item) => item.price.id !== WHATSAPP_OVERAGE_PRICE_ID,
  );
  const interval = primary?.price?.recurring?.interval;
  return interval === "year" ? "yearly" : "monthly";
}

export function extractPrimaryPriceId(subscription: {
  items: { data: Array<{ price: { id: string } }> };
}): string | null {
  const items = subscription.items.data;

  const planItem = items.find(
    (item) =>
      item.price.id !== WHATSAPP_OVERAGE_PRICE_ID &&
      resolvePriceToTier(item.price.id) !== null,
  );
  if (planItem) return planItem.price.id;

  const nonOverage = items.find(
    (item) => item.price.id !== WHATSAPP_OVERAGE_PRICE_ID,
  );
  return nonOverage?.price.id ?? null;
}

export function extractTrialEndsAt(subscription: {
  trial_end?: number | null;
}): string | null {
  if (!subscription.trial_end) return null;
  return new Date(subscription.trial_end * 1000).toISOString();
}

export function isMainPlanSubscription(subscription: {
  metadata?: Record<string, string> | null;
  items: { data: Array<{ price: { id: string } }> };
}): boolean {
  return classifySubscription(subscription) === "main";
}
