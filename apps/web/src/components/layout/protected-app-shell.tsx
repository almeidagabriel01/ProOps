"use client";

import * as React from "react";
import { Header } from "@/components/layout/header";
import { BottomDock } from "@/components/layout/bottom-dock";
import { SubscriptionGuard } from "@/components/shared/subscription-guard";
import { AppOnboarding } from "@/components/onboarding/app-onboarding";
import { LiaContainer } from "@/components/lia/lia-container";
import { BillingStateBanner } from "@/components/layout/billing-state-banner";
import { PriceChangeBanner } from "@/components/billing/price-change-banner";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useAuth } from "@/providers/auth-provider";
import { StripeService } from "@/services/stripe-service";
import { AddonService } from "@/services/addon-service";
import { formatDateBR } from "@/utils/date-format";
import { useRouter } from "next/navigation";
import {
  ScrollContainerProvider,
  useRegisterScrollContainer,
} from "@/providers/scroll-container-provider";

function ProtectedShell({ children }: { children: React.ReactNode }) {
  const { planTier, pastDueAddons } = usePlanLimits();
  const { user } = useAuth();
  const router = useRouter();
  const [isOpeningPortal, setIsOpeningPortal] = React.useState(false);
  const registerMain = useRegisterScrollContainer();

  React.useEffect(() => {
    document.documentElement.dataset.shell = "locked";
    return () => {
      delete document.documentElement.dataset.shell;
    };
  }, []);

  const activePastDueAddons = React.useMemo(
    () => pastDueAddons.filter((info) => !info.isExpired),
    [pastDueAddons],
  );

  const singlePastDueAddonName = React.useMemo(() => {
    if (activePastDueAddons.length !== 1) return null;
    const info = activePastDueAddons[0];
    return (
      AddonService.getAddonDefinition(info.addon.addonType)?.name ??
      info.addon.addonType
    );
  }, [activePastDueAddons]);

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

  const cancelAtFormatted =
    user?.cancelAt
      ? formatDateBR(user.cancelAt, "—")
      : isCancelAtPeriodEnd && user?.currentPeriodEnd
        ? formatDateBR(user.currentPeriodEnd, "—")
        : "—";

  return (
    <SubscriptionGuard>
      <div className="flex h-screen overflow-hidden bg-card">
        <div className="flex-1 flex flex-col bg-background overflow-hidden min-h-0">
          <Header sidebarWidth={0} />
          <PriceChangeBanner />
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
          {user !== null && activePastDueAddons.length === 1 && (
            <BillingStateBanner
              variant="warning"
              message={`Add-on ${singlePastDueAddonName}: pagamento em atraso. Regularize para evitar o cancelamento.`}
              ctaLabel={isOpeningPortal ? "Abrindo..." : "Atualizar pagamento"}
              onCta={handleOpenPortal}
              ctaDisabled={isOpeningPortal}
              dataTestid="banner-addon-past-due"
            />
          )}
          {user !== null && activePastDueAddons.length > 1 && (
            <BillingStateBanner
              variant="warning"
              message={`${activePastDueAddons.length} add-ons com pagamento em atraso. Regularize para evitar o cancelamento.`}
              ctaLabel="Ver add-ons"
              onCta={() => router.push("/profile/addons")}
              dataTestid="banner-addons-past-due"
            />
          )}
          <main
            id="main-content"
            ref={registerMain}
            className="flex-1 min-h-0 p-8 overflow-y-auto"
          >
            {children}
          </main>
          <AppOnboarding />
        </div>
        <BottomDock />
        {planTier !== undefined && user !== null && user.role !== "free" && (
          <LiaContainer />
        )}
      </div>
    </SubscriptionGuard>
  );
}

export function ProtectedAppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ScrollContainerProvider>
      <ProtectedShell>{children}</ProtectedShell>
    </ScrollContainerProvider>
  );
}
