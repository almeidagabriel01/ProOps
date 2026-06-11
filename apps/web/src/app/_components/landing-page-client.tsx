"use client";

import React from "react";
import {
  useLandingPage,
  LandingNavbar,
  LandingHeroAssemble,
  LandingFeatureScroll,
  LandingModules,
  LandingHowItWorks,
  LandingFeatures,
  LandingIntegrations,
  LandingNiches,
  LandingSecurity,
  LandingPricing,
  LandingFAQ,
  LandingCTA,
  LandingFooter,
} from "@/components/landing";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import Lenis from "lenis";

export function LandingPageClient() {
  const {
    currentUser,
    isAuthLoading,
    billingInterval,
    setBillingInterval,
    plans,
    isLoadingPlans,
    handleSignOut,
  } = useLandingPage();

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    gsap.registerPlugin(ScrollTrigger);
    const timeoutId = window.setTimeout(() => {
      ScrollTrigger.refresh();
    }, 500);

    // Lenis (smooth scroll) sincronizado ao ScrollTrigger — só na landing e
    // só quando o usuário não pediu redução de movimento
    let lenis: Lenis | null = null;
    let raf: ((time: number) => void) | null = null;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      lenis = new Lenis();
      lenis.on("scroll", ScrollTrigger.update);
      raf = (time: number) => lenis?.raf(time * 1000);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
    }

    return () => {
      window.clearTimeout(timeoutId);
      if (raf) gsap.ticker.remove(raf);
      lenis?.destroy();
    };
  }, []);

  return (
    <div className="min-h-screen overflow-x-clip bg-white text-black selection:bg-black selection:text-white dark:bg-neutral-950 dark:text-neutral-100 dark:selection:bg-white dark:selection:text-black">
      <LandingNavbar currentUser={currentUser} isAuthLoading={isAuthLoading} onSignOut={handleSignOut} />

      <main>
        <LandingHeroAssemble />
        <LandingFeatureScroll />
        <LandingModules />
        <LandingHowItWorks />
        <LandingFeatures />
        <LandingIntegrations />
        <LandingNiches />
        <LandingSecurity />

        <LandingPricing
          plans={plans}
          currentUser={currentUser}
          billingInterval={billingInterval}
          setBillingInterval={setBillingInterval}
          isLoading={isLoadingPlans}
        />

        <LandingFAQ />
        <LandingCTA />
      </main>

      <LandingFooter />
    </div>
  );
}
