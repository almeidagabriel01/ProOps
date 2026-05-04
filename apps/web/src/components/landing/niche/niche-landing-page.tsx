"use client";

import React from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { useLandingPage, LandingNavbar, LandingFooter } from "@/components/landing";
import { NicheHero } from "./niche-hero";
import { NicheFeatures } from "./niche-features";
import { NicheModules } from "./niche-modules";
import { NicheFaq } from "./niche-faq";
import { NicheCta } from "./niche-cta";
import { NICHE_LANDING_CONFIG } from "@/lib/landing/niches.config";

interface NicheLandingPageProps {
  slug: "automacao_residencial" | "cortinas";
}

export function NicheLandingPage({ slug }: NicheLandingPageProps) {
  const config = NICHE_LANDING_CONFIG[slug];
  const { currentUser, isAuthLoading, handleSignOut } = useLandingPage();

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      gsap.registerPlugin(ScrollTrigger);
      const timeoutId = window.setTimeout(() => {
        ScrollTrigger.refresh();
      }, 500);
      return () => window.clearTimeout(timeoutId);
    }
  }, []);

  return (
    <div className="min-h-screen overflow-x-clip bg-white text-black selection:bg-black selection:text-white dark:bg-neutral-950 dark:text-neutral-100 dark:selection:bg-white dark:selection:text-black">
      <LandingNavbar currentUser={currentUser} isAuthLoading={isAuthLoading} onSignOut={handleSignOut} />

      <main>
        <NicheHero hero={config.hero} currentUser={currentUser} isAuthLoading={isAuthLoading} />
        <NicheFeatures features={config.features} />
        <NicheModules
          modules={config.modules}
          sectionTitle={config.modulesSection.title}
          sectionSubtitle={config.modulesSection.subtitle}
        />
        <NicheFaq faq={config.faq} />
        <NicheCta cta={config.cta} />
      </main>

      <LandingFooter />
    </div>
  );
}
