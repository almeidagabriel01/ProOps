"use client";

import React from "react";

import {
  useLandingPage,
  LandingNavbar,
  LandingHero,
  LandingFeatures,
  LandingPricing,
  LandingCTA,
  LandingFooter,
  LandingFAQ,
} from "@/components/landing";
import { FullPageLoading } from "@/components/ui/full-page-loading";

export default function LandingPage() {
  const {
    isCheckingAuth,
    isRedirecting,
    currentUser,
    billingInterval,
    setBillingInterval,
    plans,
    isLoadingPlans,
    handleSignOut,
  } = useLandingPage();

  // Show loading when checking for existing session or redirecting to dashboard
  if (isRedirecting || isCheckingAuth) {
    return (
      <FullPageLoading
        message={isRedirecting ? "Entrando..." : "Verificando sessão..."}
        description={
          isRedirecting
            ? "Redirecionando para sua conta"
            : "Conectando à sua conta"
        }
      />
    );
  }

  // Render page directly - navbar handles loading state for user profile
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNavbar currentUser={currentUser} onSignOut={handleSignOut} />

      <LandingHero />

      <LandingFeatures />

      <LandingPricing
        plans={plans}
        billingInterval={billingInterval}
        setBillingInterval={setBillingInterval}
        isLoading={isLoadingPlans}
      />

      <LandingFAQ />

      <LandingCTA />

      <LandingFooter />
    </div>
  );
}
