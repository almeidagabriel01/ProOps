"use client";

import * as React from "react";
import { Header } from "@/components/layout/header";
import { BottomDock } from "@/components/layout/bottom-dock";
import { SubscriptionGuard } from "@/components/shared/subscription-guard";
import { AppOnboarding } from "@/components/onboarding/app-onboarding";
import { LiaContainer } from "@/components/lia/lia-container";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useAuth } from "@/providers/auth-provider";

export function ProtectedAppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { planTier } = usePlanLimits();
  const { user } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden bg-card">
      <div className="flex-1 flex flex-col bg-background overflow-hidden">
        <Header sidebarWidth={0} />
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
