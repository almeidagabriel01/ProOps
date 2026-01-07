"use client";

import * as React from "react";
import { useAuth } from "@/providers/auth-provider";
import { SubscriptionStatus } from "@/types";
import { AlertTriangle, CreditCard, Clock, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StripeService } from "@/services/stripe-service";
import { useRouter } from "next/navigation";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { AddonService } from "@/services/addon-service";

interface SubscriptionGuardProps {
  children: React.ReactNode;
}

const GRACE_PERIOD_DAYS = 7;

export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = React.useState(false);
  const { pastDueAddons } = usePlanLimits();

  const shouldCheckSubscription = React.useMemo(() => {
    if (!user) return false;
    if (user.role === "free" || user.role === "superadmin") return false;
    if (user.masterId) return false;
    return true;
  }, [user]);

  const currentPeriodEnd = user?.currentPeriodEnd;
  const subscriptionStatus = user?.subscriptionStatus;
  const subscriptionUpdatedAt = user?.subscriptionUpdatedAt;

  const { daysRemaining, isGracePeriodExpired } = React.useMemo(() => {
    if (subscriptionStatus !== "past_due") {
      return { daysRemaining: GRACE_PERIOD_DAYS, isGracePeriodExpired: false };
    }

    const referenceDate = currentPeriodEnd
      ? new Date(currentPeriodEnd)
      : (subscriptionUpdatedAt ? new Date(subscriptionUpdatedAt) : new Date());

    const deadline = new Date(referenceDate);
    deadline.setDate(deadline.getDate() + GRACE_PERIOD_DAYS);

    const now = new Date();
    const diffTime = deadline.getTime() - now.getTime();
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const remaining = Math.max(0, days);

    return {
      daysRemaining: remaining,
      isGracePeriodExpired: days <= 0,
    };
  }, [subscriptionStatus, currentPeriodEnd, subscriptionUpdatedAt]);

  React.useEffect(() => {
    if (!shouldCheckSubscription || isLoading) return;

    const blockedStatuses: SubscriptionStatus[] = [
      "canceled",
      "unpaid",
      "inactive",
    ];

    if (subscriptionStatus && blockedStatuses.includes(subscriptionStatus)) {
      router.push("/subscription-blocked");
      return;
    }

    if (subscriptionStatus === "past_due" && isGracePeriodExpired) {
      router.push("/subscription-blocked");
    }
  }, [
    subscriptionStatus,
    shouldCheckSubscription,
    isLoading,
    router,
    isGracePeriodExpired,
  ]);

  const showWarningBanner =
    shouldCheckSubscription &&
    subscriptionStatus === "past_due" &&
    !isGracePeriodExpired;

  // Filter add-on warnings to show only non-expired ones
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
    return <>{children}</>;
  }

  return (
    <>
      {/* Plan subscription warning */}
      {showWarningBanner && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-md animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="bg-yellow-50 dark:bg-yellow-950/90 border border-yellow-400 dark:border-yellow-600 rounded-xl shadow-lg p-4 backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <div className="shrink-0 p-2 bg-yellow-100 dark:bg-yellow-900/50 rounded-full">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                  Pagamento Pendente
                </h4>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  Sua assinatura está com pagamento atrasado. Atualize para
                  evitar a perda de acesso.
                </p>
                <div className="flex items-center gap-1.5 mt-2 text-xs font-medium text-yellow-800 dark:text-yellow-200">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    {daysRemaining === 1
                      ? "Último dia para regularizar"
                      : `${daysRemaining} dias restantes`}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManageBilling}
                  disabled={isRedirecting}
                  className="mt-3 h-8 text-xs border-yellow-500 text-yellow-700 hover:bg-yellow-100 dark:border-yellow-500 dark:text-yellow-300 dark:hover:bg-yellow-900/50"
                >
                  <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                  {isRedirecting ? "Abrindo..." : "Atualizar Pagamento"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add-on payment warnings */}
      {addonWarnings.map((info, index) => {
        const addonDef = AddonService.getAddonDefinition(info.addon.addonType);
        const addonName = addonDef?.name || info.addon.addonType;
        const topOffset = showWarningBanner ? 44 + (index + 1) * 8 : 20 + index * 8;

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

