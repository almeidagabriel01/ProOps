"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useTenant } from "@/providers/tenant-provider";
import { PlanService } from "@/services/plan-service";
import type { UserPlan } from "@/types";

export interface PriceChangeInfo {
  hasDrift: boolean;
  currentPriceFormatted: string | null;
  newPriceFormatted: string | null;
  renewalDate: Date | null;
  cancelUrl: string;
}

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

/**
 * Detects whether the tenant's locked subscription price differs from the
 * current live price for their plan tier. When drift is detected and the
 * renewal is within 30 days, the UI shows a warning banner.
 *
 * Data sources:
 * - `tenant.subscription.unitAmount` — the price actually billed today (centavos),
 *   written by the backend cron that detects Stripe price drift
 * - live plan pricing from PlanService (fetched once, cached 5 min)
 * - `user.stripeSubscriptionId` — confirms this is a Stripe-managed subscription
 * - `user.isManualSubscription` — manual subs are exempt from drift logic
 * - `user.currentPeriodEnd` — next renewal date
 * - `user.billingInterval` — monthly or yearly
 */
export function usePriceChange(): PriceChangeInfo {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [livePlan, setLivePlan] = useState<UserPlan | null>(null);

  const { planId, stripeSubscriptionId, isManualSubscription, billingInterval, currentPeriodEnd } =
    user ?? {};

  // Fetch the live plan for the user's plan tier once.
  // effectiveLivePlan is null whenever the subscription is not Stripe-managed so
  // the memo never compares against a stale plan from a previous tier.
  const effectiveLivePlan =
    planId && stripeSubscriptionId && !isManualSubscription ? livePlan : null;

  useEffect(() => {
    if (!planId || !stripeSubscriptionId || isManualSubscription) return;

    let cancelled = false;
    PlanService.getLivePlans()
      .then((plans) => {
        if (cancelled || !plans) return;
        const match = plans.find(
          (p) =>
            p.id === planId ||
            p.tier === planId ||
            p.tier === planId.toLowerCase(),
        );
        setLivePlan(match ?? null);
      })
      .catch(() => {
        if (!cancelled) setLivePlan(null);
      });

    return () => {
      cancelled = true;
    };
  }, [planId, stripeSubscriptionId, isManualSubscription]);

  return useMemo((): PriceChangeInfo => {
    const noChange: PriceChangeInfo = {
      hasDrift: false,
      currentPriceFormatted: null,
      newPriceFormatted: null,
      renewalDate: null,
      cancelUrl: "/profile?tab=subscription",
    };

    // Only applies to Stripe-managed subscriptions
    if (!stripeSubscriptionId || isManualSubscription) {
      return noChange;
    }

    // Snapshot price the customer currently pays (written to tenant doc by backend)
    const snapshotCentavos = tenant?.subscription?.unitAmount;
    if (snapshotCentavos == null || effectiveLivePlan == null) {
      return noChange;
    }

    // Live tier price for the user's billing interval
    const interval = billingInterval ?? "monthly";
    const livePriceBRL =
      interval === "yearly"
        ? effectiveLivePlan.pricing?.yearly
        : effectiveLivePlan.pricing?.monthly;

    if (livePriceBRL == null) {
      return noChange;
    }

    const snapshotPriceBRL = snapshotCentavos / 100;

    // Compare in centavos to avoid floating-point precision issues
    const snapshotRounded = Math.round(snapshotCentavos);
    const liveRounded = Math.round(livePriceBRL * 100);
    if (snapshotRounded === liveRounded) {
      return noChange;
    }

    const renewalDate = currentPeriodEnd ? new Date(currentPeriodEnd) : null;

    return {
      hasDrift: true,
      currentPriceFormatted: formatBRL(snapshotPriceBRL),
      newPriceFormatted: formatBRL(livePriceBRL),
      renewalDate,
      cancelUrl: "/profile?tab=subscription",
    };
  }, [
    stripeSubscriptionId,
    isManualSubscription,
    billingInterval,
    currentPeriodEnd,
    tenant?.subscription?.unitAmount,
    effectiveLivePlan,
  ]);
}
