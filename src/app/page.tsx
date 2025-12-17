"use client";

import React from "react";
import { Sparkles } from "lucide-react";
import {
  useLandingPage,
  LandingNavbar,
  LandingHero,
  LandingFeatures,
  LandingPricing,
  LandingCTA,
  LandingFooter,
} from "@/components/landing";

export default function LandingPage() {
  const {
    isCheckingAuth,
    currentUser,
    billingInterval,
    setBillingInterval,
    plans,
    handleSignOut,
  } = useLandingPage();

  // Show loading while checking auth
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Sparkles className="h-10 w-10 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <LandingNavbar
        currentUser={currentUser}
        onSignOut={handleSignOut}
      />

      <LandingHero />

      <LandingFeatures />

      <LandingPricing
        plans={plans}
        billingInterval={billingInterval}
        setBillingInterval={setBillingInterval}
      />

      <LandingCTA />

      <LandingFooter />
    </div>
  );
}
