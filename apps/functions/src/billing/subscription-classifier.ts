import { WHATSAPP_OVERAGE_PRICE_ID } from "../stripe/stripeHelpers";
import { resolvePriceToTier } from "../lib/tenant-plan-policy";

export type SubscriptionClass = "main" | "addon" | "overage";

type ClassifiableSubscription = {
  metadata?: Record<string, string> | null;
  items: { data: Array<{ price: { id: string } }> };
};

/**
 * Classifies a Stripe subscription as main plan, addon, or overage.
 *
 * Priority order:
 * 1. metadata.type field (most reliable — set by subscription_data.metadata at checkout creation)
 * 2. All items are WHATSAPP_OVERAGE_PRICE_ID → overage
 * 3. Any item resolves to a known plan tier → main
 * 4. No plan items and not all overage → addon (safe fallback for pre-fix subscriptions)
 *
 * This ensures that even if metadata was not propagated correctly (pre-fix behavior),
 * addon subscriptions are still identified correctly by price ID exclusion.
 */
export function classifySubscription(sub: ClassifiableSubscription): SubscriptionClass {
  const metaType = sub.metadata?.type;
  if (metaType === "addon") return "addon";
  if (metaType === "overage") return "overage";

  const items = sub.items.data;

  if (items.length > 0 && items.every((item) => item.price.id === WHATSAPP_OVERAGE_PRICE_ID)) {
    return "overage";
  }

  const hasMainPlanPrice = items.some(
    (item) =>
      item.price.id !== WHATSAPP_OVERAGE_PRICE_ID &&
      resolvePriceToTier(item.price.id) !== null,
  );
  if (hasMainPlanPrice) return "main";

  // No known plan prices and not all overage → treat as addon.
  // This handles pre-fix addon subscriptions that had empty metadata.
  return "addon";
}
