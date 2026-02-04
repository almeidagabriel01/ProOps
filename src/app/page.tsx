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
    isRedirecting,
    currentUser,
    billingInterval,
    setBillingInterval,
    plans,
    isLoadingPlans,
    handleSignOut,
  } = useLandingPage();

  // Show loading when redirecting to dashboard
  if (isRedirecting) {
    return (
      <FullPageLoading
        message="Entrando..."
        description="Verificando sua sessão"
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
