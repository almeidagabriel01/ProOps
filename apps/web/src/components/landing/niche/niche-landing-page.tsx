"use client";

import React from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { useLandingPage, LandingNavbar } from "@/components/landing";
import { NicheHero } from "./niche-hero";
import { NICHE_LANDING_CONFIG } from "@/lib/landing/niches.config";

// Abaixo da dobra: code-split com next/dynamic (ssr: true), HTML preservado.
const NicheFeatures = dynamic(() =>
  import("./niche-features").then((m) => m.NicheFeatures),
);
const NicheModules = dynamic(() =>
  import("./niche-modules").then((m) => m.NicheModules),
);
const NicheFaq = dynamic(() => import("./niche-faq").then((m) => m.NicheFaq));
const NicheCta = dynamic(() => import("./niche-cta").then((m) => m.NicheCta));
const LandingFooter = dynamic(() =>
  import("@/components/landing/landing-footer").then((m) => m.LandingFooter),
);

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
