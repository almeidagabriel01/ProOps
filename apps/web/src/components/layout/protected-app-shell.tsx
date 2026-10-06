"use client";

import * as React from "react";
import { Header } from "@/components/layout/header";
import { BottomDock } from "@/components/layout/bottom-dock";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { SubscriptionGuard } from "@/components/shared/subscription-guard";
import { AppOnboarding } from "@/components/onboarding/app-onboarding";
import { OnboardingProvider } from "@/components/onboarding/onboarding-provider";
import { LiaContainer } from "@/components/lia/lia-container";
import { BillingStateBanner } from "@/components/layout/billing-state-banner";
import { PriceChangeBanner } from "@/components/billing/price-change-banner";
import { ApprovalNextStepsHost } from "@/components/features/proposal/approval-next-steps-host";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useAuth } from "@/providers/auth-provider";
import { useSessionPing } from "@/hooks/use-session-ping";
import { useActivityTracking } from "@/hooks/use-activity-tracking";
import { usePermission } from "@/hooks/usePermission";
import { trackActivity } from "@/lib/activity/activity-tracker";
import { useTenant } from "@/providers/tenant-provider";
import { useViewingMember } from "@/providers/viewing-member-provider";
import { usePermissions } from "@/providers/permissions-provider";
import { resolveBillingBanner } from "@/lib/billing/billing-banner";
import { SUPPORT_WHATSAPP_DIGITS, buildWhatsAppHref } from "@/lib/whatsapp-contacts";
import { StripeService } from "@/services/stripe-service";
import { AddonService } from "@/services/addon-service";
import { useRouter } from "next/navigation";
import {
  ScrollContainerProvider,
  useRegisterScrollContainer,
} from "@/providers/scroll-container-provider";

function ProtectedShell({ children }: { children: React.ReactNode }) {
  const { planTier, pastDueAddons, trialInfo } = usePlanLimits();
  const { user } = useAuth();
  const { tenant, isDemo } = useTenant();
  // A Lia grava conversa e histórico: no "Ver como membro" ela ficaria em nome
  // do membro, e o backend recusa a escrita nesse modo.
  const { member: viewingMember } = useViewingMember();
  const { isMaster } = usePermissions();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [isOpeningPortal, setIsOpeningPortal] = React.useState(false);
  const [isReactivating, setIsReactivating] = React.useState(false);
  const registerMain = useRegisterScrollContainer();

  // Marca o acesso da empresa (uma vez por navegador, por dia). Ver
  // hooks/use-session-ping.ts.
  useSessionPing(user);
  // Telas abertas, para a atividade da empresa no painel do super admin.
  useActivityTracking(user);

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

  // Data do render inicial: a faixa conta dias, não precisa de relógio vivo.
  const [now] = React.useState(() => new Date());
  const billingBanner = React.useMemo(
    () => resolveBillingBanner({ tenant, isTenantAdmin: isMaster, now }),
    [tenant, isMaster, now],
  );

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

  const handleReactivate = React.useCallback(async () => {
    if (!user) return;
    setIsReactivating(true);
    try {
      await StripeService.reactivateSubscription();
      router.refresh();
    } catch (error) {
      console.error("[ProtectedAppShell] Failed to reactivate subscription:", error);
    } finally {
      setIsReactivating(false);
    }
  }, [user, router]);

  const handleContactSupport = React.useCallback(() => {
    window.open(
      buildWhatsAppHref(SUPPORT_WHATSAPP_DIGITS, "Olá! Quero renovar o plano da minha empresa na ProOps."),
      "_blank",
      "noopener,noreferrer",
    );
  }, []);

  // Trial banner copy escalates as the 7-day period nears its end.
  const trialDays = trialInfo.daysRemaining;
  const trialIsUrgent = trialInfo.isTrialing && trialDays <= 3;
  // Informational only — the card was collected at checkout, so the trial
  // converts automatically at the end (no "assinar" action for the user to take).
  const trialMessage =
    trialDays <= 0
      ? "Seu período gratuito termina hoje: sua assinatura será cobrada automaticamente."
      : trialDays === 1
        ? "Falta 1 dia no seu período gratuito."
        : `Você está no período gratuito: faltam ${trialDays} dias.`;

  return (
    <SubscriptionGuard>
      <div
        className="flex h-[100dvh] md:h-screen overflow-hidden bg-card"
        data-demo-readonly={isDemo || undefined}
      >
        <div className="flex-1 flex flex-col bg-background overflow-hidden min-h-0">
          <Header sidebarWidth={0} />
          <PriceChangeBanner />
          <ApprovalNextStepsHost />
          {isDemo && (
            <BillingStateBanner
              variant="info"
              message="Você está no modo demonstração: os dados são fictícios e não podem ser alterados. Assine para usar o ERP com seus próprios dados."
              ctaLabel="Assinar agora"
              onCta={() => {
                trackActivity("subscribe_clicked", { meta: { source: "demo_banner" } });
                router.push("/profile?tab=billing");
              }}
              dataTestid="billing-state-banner-demo"
            />
          )}
          {user !== null && trialInfo.isTrialing && (
            <BillingStateBanner
              variant={trialIsUrgent ? "warning" : "info"}
              message={trialMessage}
              dataTestid="billing-state-banner-trial"
            />
          )}
          {user !== null && billingBanner?.kind === "past_due" && (
            <BillingStateBanner
              variant={billingBanner.variant}
              message={billingBanner.message}
              ctaLabel={isOpeningPortal ? "Abrindo..." : "Atualizar pagamento"}
              onCta={handleOpenPortal}
              ctaDisabled={isOpeningPortal}
              dataTestid={billingBanner.dataTestid}
            />
          )}
          {user !== null && billingBanner?.kind === "cancel_scheduled" && (
            <BillingStateBanner
              variant={billingBanner.variant}
              message={billingBanner.message}
              ctaLabel={isReactivating ? "Reativando..." : "Reativar assinatura"}
              onCta={handleReactivate}
              ctaDisabled={isReactivating}
              dataTestid={billingBanner.dataTestid}
            />
          )}
          {user !== null &&
            (billingBanner?.kind === "manual_expiring" || billingBanner?.kind === "manual_expired") && (
              <BillingStateBanner
                variant={billingBanner.variant}
                message={billingBanner.message}
                ctaLabel="Assinar pelo cartão"
                onCta={() => router.push("/profile?tab=billing")}
                secondaryCtaLabel="Falar com a ProOps"
                onSecondaryCta={handleContactSupport}
                dataTestid={billingBanner.dataTestid}
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
            className="flex-1 min-h-0 p-4 md:p-8 overflow-y-auto"
          >
            {children}
          </main>
          {isMobile && <MobileTabBar />}
          <AppOnboarding />
        </div>
        {!isMobile && <BottomDock />}
        {planTier !== undefined && user !== null && user.role !== "free" && !viewingMember && (
          <LiaGate />
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
      <OnboardingProvider>
        <ProtectedShell>{children}</ProtectedShell>
      </OnboardingProvider>
    </ScrollContainerProvider>
  );
}

/**
 * A Lia só aparece para quem pode usá-la: é uma permissão de membro, ligada
 * por padrão, que o dono desliga por pessoa (o backend recusa a conversa do
 * mesmo jeito).
 */
function LiaGate() {
  const canUseLia = usePermission("lia", "canView");
  return canUseLia ? <LiaContainer /> : null;
}
