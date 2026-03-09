"use client";

import React from "react";
import {
  useLandingPage,
  LandingNavbar,
  LandingHeroFrames,
  LandingShowcase,
  LandingModules,
  LandingFeatures,
  LandingPricing,
  LandingCTA,
  LandingFooter,
} from "@/components/landing";
import { FullPageLoading } from "@/components/ui/full-page-loading";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
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

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      gsap.registerPlugin(ScrollTrigger);
      // Ensure all GSAP calculations refresh after pinned containers or images fully render
      const tId = setTimeout(() => {
        ScrollTrigger.refresh();
      }, 500);
      return () => clearTimeout(tId);
    }
  }, [isCheckingAuth, isRedirecting]);

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

  return (
    <div className="min-h-screen bg-white text-black dark:bg-neutral-950 dark:text-neutral-100 selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black">
      <LandingNavbar currentUser={currentUser} onSignOut={handleSignOut} />

      <main>
        <LandingHeroFrames />
        <LandingShowcase />
        <LandingModules />
        <LandingFeatures />

        <div className="w-full h-px bg-gradient-to-r from-transparent via-black/15 to-transparent dark:via-white/15 max-w-7xl mx-auto" />

        <LandingPricing
          plans={plans}
          currentUser={currentUser}
          billingInterval={billingInterval}
          setBillingInterval={setBillingInterval}
          isLoading={isLoadingPlans}
        />

        <div className="w-full h-px bg-gradient-to-r from-transparent via-black/15 to-transparent dark:via-white/15 max-w-7xl mx-auto" />

        <LandingCTA />
      </main>

      <LandingFooter />
    </div>
  );
}
