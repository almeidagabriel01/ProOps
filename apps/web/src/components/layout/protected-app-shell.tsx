"use client";

import * as React from "react";
import { Header } from "@/components/layout/header";
import { BottomDock } from "@/components/layout/bottom-dock";
import { SubscriptionGuard } from "@/components/shared/subscription-guard";
import { AppOnboarding } from "@/components/onboarding/app-onboarding";
import { LiaContainer } from "@/components/lia/lia-container";
import { BillingStateBanner } from "@/components/layout/billing-state-banner";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useAuth } from "@/providers/auth-provider";
import { StripeService } from "@/services/stripe-service";
import { formatDateBR } from "@/utils/date-format";

export function ProtectedAppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { planTier } = usePlanLimits();
  const { user } = useAuth();
  const [isOpeningPortal, setIsOpeningPortal] = React.useState(false);

  const subscriptionStatus = user?.subscriptionStatus;
  const isPastDue = subscriptionStatus === "past_due";
  const isCancelAtPeriodEnd = !isPastDue && user?.cancelAtPeriodEnd === true;

  const handleOpenPortal = React.useCallback(async () => {
    if (!user) return;
    setIsOpeningPortal(true);
    try {
      const result = await StripeService.createPortalSession({
        userId: user.id,
      });
      if (result?.url) {
        window.location.href = result.url;
      } else {
        setIsOpeningPortal(false);
      }
    } catch (error) {
      console.error("[ProtectedAppShell] Failed to open Stripe portal:", error);
      setIsOpeningPortal(false);
    }
  }, [user]);

  const cancelAtFormatted = user?.cancelAt
    ? formatDateBR(user.cancelAt, "—")
    : "—";

  return (
    <div className="flex h-screen overflow-hidden bg-card">
      <div className="flex-1 flex flex-col bg-background overflow-hidden">
        <Header sidebarWidth={0} />
        {user !== null && isPastDue && (
          <BillingStateBanner
            variant="destructive"
            message="Seu pagamento está em atraso. Regularize para manter o acesso."
            ctaLabel={isOpeningPortal ? "Abrindo..." : "Atualizar pagamento"}
            onCta={handleOpenPortal}
            ctaDisabled={isOpeningPortal}
            dataTestid="billing-state-banner-past-due"
          />
        )}
        {user !== null && isCancelAtPeriodEnd && (
          <BillingStateBanner
            variant="warning"
            message={`Sua assinatura será cancelada em ${cancelAtFormatted}. Reativar?`}
            ctaLabel="Reativar assinatura"
            onCta={() => {}}
            ctaDisabled
            ctaDisabledTooltip="Disponível em breve"
            dataTestid="billing-state-banner-cancel-period-end"
          />
        )}
        <SubscriptionGuard>
          <main id="main-content" className="flex-1 p-8 overflow-y-auto">
            {children}
          </main>
        </SubscriptionGuard>
        <AppOnboarding />
      </div>
      <BottomDock />
      {/* Only render Lia for paid plan users; undefined planTier = still loading, null user = auth loading, role "free" = free plan */}
      {planTier !== undefined && user !== null && user.role !== "free" && <LiaContainer />}
    </div>
  );
}
