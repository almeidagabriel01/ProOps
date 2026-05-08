"use client";

import * as React from "react";
import { useAuth } from "@/providers/auth-provider";
import { useTenant } from "@/providers/tenant-provider";
import { CreditCard, Clock, Package } from "lucide-react";
import { Loader } from "@/components/ui/loader";
import { Button } from "@/components/ui/button";
import { StripeService } from "@/services/stripe-service";
import { useRouter } from "next/navigation";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { AddonService } from "@/services/addon-service";

interface SubscriptionGuardProps {
  children: React.ReactNode;
}

const GRACE_PERIOD_DAYS = 7;

const BLOCKED_STATUSES = new Set([
  "canceled",
  "cancelled",
  "unpaid",
  "inactive",
  "payment_failed",
]);

export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { tenant, isLoading: isTenantLoading } = useTenant();
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = React.useState(false);
  const { pastDueAddons } = usePlanLimits();

  const isLoading = isAuthLoading || isTenantLoading;

  const shouldCheckSubscription = React.useMemo(() => {
    if (!user) return false;
    // superadmin is never blocked — they must be able to access any tenant panel
    if (user.role === "superadmin") return false;
    // "free" role means the account has never had a paid plan — nothing to enforce
    if (user.role === "free") return false;
    const status = tenant?.subscriptionStatus ?? user.subscriptionStatus;
    // subscriptionStatus "free" also means no active subscription to enforce
    if (status === "free") return false;
    return true;
  }, [user, tenant?.subscriptionStatus]);

  // Prefer tenant billing fields (synced from Stripe) over user fields.
  const subscriptionStatus = tenant?.subscriptionStatus ?? user?.subscriptionStatus;
  const currentPeriodEnd = tenant?.currentPeriodEnd ?? user?.currentPeriodEnd ?? null;
  const cancelAtPeriodEnd = tenant?.cancelAtPeriodEnd ?? user?.cancelAtPeriodEnd;
  // pastDueSince is set by the Stripe webhook at the first failed payment attempt.
  // If absent for a past_due tenant, we treat the grace period as expired to match
  // the behavior of billing-status/route.ts and require-active-subscription.ts.
  const pastDueSince = tenant?.pastDueSince ?? null;

  const { isGracePeriodExpired } = React.useMemo(() => {
    if (subscriptionStatus !== "past_due") {
      return { isGracePeriodExpired: false };
    }
    if (!pastDueSince) {
      // No reference date — consistent with billing-status route: treat as expired.
      return { isGracePeriodExpired: true };
    }
    const referenceMs = Date.parse(pastDueSince);
    if (!Number.isFinite(referenceMs)) {
      return { isGracePeriodExpired: true };
    }
    const graceMs = GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
    return { isGracePeriodExpired: Date.now() - referenceMs > graceMs };
  }, [subscriptionStatus, pastDueSince]);

  // Compute block decision synchronously during render so children are never
  // painted when the subscription is blocked. The redirect is a side effect
  // and stays in useEffect, but returning null here prevents the flash of
  // unprotected content that would otherwise occur before useEffect runs.
  const isBlocked = React.useMemo(() => {
    if (!shouldCheckSubscription || isLoading) return false;

    if (subscriptionStatus && BLOCKED_STATUSES.has(subscriptionStatus)) {
      return true;
    }

    if (subscriptionStatus === "past_due" && isGracePeriodExpired) {
      return true;
    }

    if (cancelAtPeriodEnd && currentPeriodEnd) {
      const periodEndDate = new Date(currentPeriodEnd);
      if (
        !Number.isNaN(periodEndDate.getTime()) &&
        periodEndDate.getTime() <= Date.now()
      ) {
        return true;
      }
    }

    return false;
  }, [
    shouldCheckSubscription,
    isLoading,
    subscriptionStatus,
    isGracePeriodExpired,
    cancelAtPeriodEnd,
    currentPeriodEnd,
  ]);

  // Secondary action: navigate to the blocked page. The render already returns
  // null above so the user never sees protected content even on the first cycle.
  React.useEffect(() => {
    if (isBlocked) {
      router.replace("/subscription-blocked");
    }
  }, [isBlocked, router]);

  const addonWarnings = React.useMemo(() => {
    return pastDueAddons.filter((info) => !info.isExpired);
  }, [pastDueAddons]);

  const handleManageBilling = async () => {
    if (!user) return;
    setIsRedirecting(true);
    try {
      const result = await StripeService.createPortalSession({
        userId: user.id,
      });
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      console.error("Error opening billing portal:", error);
      setIsRedirecting(false);
    }
  };

  if (isLoading) {
    return (
      <div
        className="flex h-full items-center justify-center"
        data-testid="subscription-guard-checking"
      >
        <Loader size="lg" />
      </div>
    );
  }

  if (isBlocked) {
    return null;
  }

  return (
    <>
      {/* Add-on payment warnings */}
      {addonWarnings.map((info, index) => {
        const addonDef = AddonService.getAddonDefinition(info.addon.addonType);
        const addonName = addonDef?.name || info.addon.addonType;
        const topOffset = 20 + index * 8;

        return (
          <div
            key={info.addon.id}
            className="fixed left-1/2 -translate-x-1/2 z-50 max-w-md animate-in slide-in-from-top-4 fade-in duration-300"
            style={{ top: `${topOffset}rem` }}
          >
            <div className="bg-orange-50 dark:bg-orange-950/90 border border-orange-400 dark:border-orange-600 rounded-xl shadow-lg p-4 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <div className="shrink-0 p-2 bg-orange-100 dark:bg-orange-900/50 rounded-full">
                  <Package className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-orange-800 dark:text-orange-200">
                    Add-on: {addonName}
                  </h4>
                  <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                    Pagamento pendente. Regularize para manter o benefício.
                  </p>
                  <div className="flex items-center gap-1.5 mt-2 text-xs font-medium text-orange-800 dark:text-orange-200">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {info.daysRemaining === 1
                        ? "Último dia para regularizar"
                        : `${info.daysRemaining} dias restantes`}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleManageBilling}
                    disabled={isRedirecting}
                    className="mt-3 h-8 text-xs border-orange-500 text-orange-700 hover:bg-orange-100 dark:border-orange-500 dark:text-orange-300 dark:hover:bg-orange-900/50"
                  >
                    <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                    {isRedirecting ? "Abrindo..." : "Atualizar Pagamento"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {children}
    </>
  );
}
